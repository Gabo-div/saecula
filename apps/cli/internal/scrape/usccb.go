package scrape

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"

	"saecula/cli/internal/model"
)

// Daily Mass readings from the United States Conference of Catholic
// Bishops, https://bible.usccb.org/bible/readings/MMDDYY.cfm — one page per
// calendar date. Each reading is one block:
//
//	<div class="innerblock">
//	  <div class="content-header">
//	    <h3 class="name">Reading 1</h3>
//	    <div class="address"><a href=".../bible/wisdom/12?13">Wisdom 12:13, 16-19</a></div>
//	  </div>
//	  ...
//	</div>
//
// A block titled "or" is an alternative citation for the previous reading.
// Only the citations are captured — verse texts belong to bible documents.
const (
	USCCBBaseURL       = "https://bible.usccb.org/bible/readings/"
	USCCBLanguageCode  = "en"
	USCCBTranslationID = "usccb_lectionary"

	// Politeness delay between page downloads.
	usccbRequestDelay = 300 * time.Millisecond

	// bible.usccb.org's Obolus bot wall is handled by ObolusFetcher (it
	// solves the proof-of-work and reuses it), so a plain HTTP-level retry
	// only needs to cover a transient network hiccup or a proof that
	// expired mid-run.
	usccbFetchAttempts = 3
	usccbRetryDelay    = 1 * time.Second
)

// USCCBReadingsURL builds the page URL for one date (MMDDYY).
func USCCBReadingsURL(date time.Time) string {
	return USCCBBaseURL + date.Format("010206") + ".cfm"
}

var lectionaryNumber = regexp.MustCompile(`Lectionary:\s*([0-9A-Za-z /-]+)`)

// hrefBookSlug extracts the book slug from a citation link like
// https://bible.usccb.org/bible/wisdom/12?13.
var hrefBookSlug = regexp.MustCompile(`/bible/([a-z0-9-]+)/`)

// USCCBScraper downloads daily readings for a date range. The Fetcher is
// injected; lengths (optional) lets cross-chapter citations expand.
type USCCBScraper struct {
	fetcher Fetcher
	lengths ChapterLengths
}

// NewUSCCBScraper builds the scraper. A nil fetcher defaults to an
// ObolusFetcher, which transparently clears the site's proof-of-work wall.
func NewUSCCBScraper(fetcher Fetcher, lengths ChapterLengths) *USCCBScraper {
	if fetcher == nil {
		fetcher = NewObolusFetcher(nil)
	}
	return &USCCBScraper{fetcher: fetcher, lengths: lengths}
}

// ScrapeReadings downloads every date in [from, to] and returns ONE
// daily_readings document. Dates in skip (ISO strings) are not fetched —
// pass the days of a previous partial run to resume it. progress (optional)
// receives one line per day.
func (s *USCCBScraper) ScrapeReadings(ctx context.Context, from, to time.Time, skip map[string]bool, progress func(string)) (*model.Document, error) {
	report := func(msg string) {
		if progress != nil {
			progress(msg)
		}
	}
	if to.Before(from) {
		return nil, fmt.Errorf("range end %s is before start %s", to.Format(time.DateOnly), from.Format(time.DateOnly))
	}

	doc := &model.Document{
		Type:          model.TypeDailyReadings,
		LanguageCode:  USCCBLanguageCode,
		TranslationID: USCCBTranslationID,
		StartYear:     int64(from.Year()),
		SourceURL:     USCCBBaseURL,
		ScrapedAt:     time.Now().UTC().Format(time.RFC3339),
	}
	endYear := int64(to.Year())
	doc.EndYear = &endYear

	total := int(to.Sub(from).Hours()/24) + 1
	failed, fetched := 0, 0
	for i, date := 0, from; !date.After(to); i, date = i+1, date.AddDate(0, 0, 1) {
		if skip[date.Format(time.DateOnly)] {
			continue
		}
		if fetched > 0 {
			time.Sleep(usccbRequestDelay)
		}
		fetched++

		day, warnings, err := s.scrapeDay(ctx, date)
		if err != nil {
			failed++
			report(fmt.Sprintf("[%d/%d] %s: SKIPPED — %v", i+1, total, date.Format(time.DateOnly), err))
			continue
		}
		for _, w := range warnings {
			report(fmt.Sprintf("[%d/%d] %s: warning — %s", i+1, total, date.Format(time.DateOnly), w))
		}
		doc.Days = append(doc.Days, *day)
		report(fmt.Sprintf("[%d/%d] %s: %s — %d readings", i+1, total, date.Format(time.DateOnly), day.Title, len(day.Readings)))
	}

	if len(doc.Days) == 0 && len(skip) == 0 {
		return nil, fmt.Errorf("no days scraped (%d failures)", failed)
	}
	if failed > 0 {
		report(fmt.Sprintf("finished with %d of %d days failed — re-run with the same --out to retry just those", failed, total))
	}
	return doc, nil
}

// scrapeDay downloads and parses one date page. Unresolvable citations are
// kept with their raw reference and reported as warnings, never as errors.
func (s *USCCBScraper) scrapeDay(ctx context.Context, date time.Time) (*model.DayReadings, []string, error) {
	url := USCCBReadingsURL(date)
	body, err := fetchWithRetry(ctx, s.fetcher, url, usccbFetchAttempts, usccbRetryDelay)
	if err != nil {
		return nil, nil, fmt.Errorf("fetch %s: %w", url, err)
	}
	defer func() { _ = body.Close() }()

	page, err := goquery.NewDocumentFromReader(body)
	if err != nil {
		return nil, nil, fmt.Errorf("parse html: %w", err)
	}

	day := &model.DayReadings{
		Date:      date.Format(time.DateOnly),
		Title:     pageTitle(page),
		SourceURL: url,
	}
	if m := lectionaryNumber.FindStringSubmatch(page.Text()); m != nil {
		day.Lectionary = strings.TrimSpace(m[1])
	}

	var warnings []string
	page.Find("div.innerblock").Each(func(_ int, block *goquery.Selection) {
		name := strings.TrimSpace(block.Find("h3.name").First().Text())
		link := block.Find("div.address a").First()
		reference := strings.TrimSpace(link.Text())
		if reference == "" {
			return // block without a citation (e.g. a Sequence hymn)
		}

		rtype := readingType(name)
		if isAcclamation(rtype) {
			return // the gospel acclamation (Alleluia / Verse before the Gospel) is not stored
		}
		reading := model.Reading{Type: rtype, Reference: reference}
		if strings.EqualFold(name, "or") {
			if n := len(day.Readings); n > 0 {
				reading.Type = day.Readings[n-1].Type
			}
			reading.Alternative = true
		}

		slug := ""
		if href, ok := link.Attr("href"); ok {
			if m := hrefBookSlug.FindStringSubmatch(href); m != nil {
				slug = m[1]
			}
		}
		ids, err := ExpandReference(reference, slug, s.lengths)
		if err != nil {
			warnings = append(warnings, fmt.Sprintf("%s %q: %v", reading.Type, reference, err))
		}
		reading.VerseIDs = ids
		day.Readings = append(day.Readings, reading)
	})

	if len(day.Readings) == 0 {
		return nil, nil, fmt.Errorf("no readings found at %s — page layout may have changed", url)
	}
	return day, warnings, nil
}

// pageTitle extracts the liturgical day name from <title>…| USCCB</title>.
func pageTitle(page *goquery.Document) string {
	title := page.Find("head title").First().Text()
	if i := strings.Index(title, "|"); i >= 0 {
		title = title[:i]
	}
	return strings.TrimSpace(title)
}

// isAcclamation reports whether a slug is the gospel acclamation, which the
// app does not store: "Alleluia", "Gospel Acclamation", or (in Lent) "Verse
// Before the Gospel".
func isAcclamation(slug string) bool {
	switch slug {
	case "alleluia", "gospel_acclamation", "verse_before_the_gospel":
		return true
	}
	return false
}

// readingType slugifies a block heading: "Responsorial Psalm" →
// "responsorial_psalm", "Reading 1" → "reading_1".
func readingType(name string) string {
	var out []rune
	for _, r := range strings.ToLower(strings.TrimSpace(name)) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			out = append(out, r)
		default: // any separator, including non-breaking spaces
			if len(out) > 0 && out[len(out)-1] != '_' {
				out = append(out, '_')
			}
		}
	}
	return strings.TrimSuffix(string(out), "_")
}
