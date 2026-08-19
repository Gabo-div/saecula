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

// Daily Mass readings from Vatican News in Spanish,
// https://www.vaticannews.va/es/evangelio-de-hoy/YYYY/MM/DD.html — one page
// per date; the .print.html variant is the same content in lighter markup.
//
//	<section>
//	  <h2>Lectura del Día</h2>
//	  <p>Primera lectura</p>                          (Sundays/solemnities)
//	  <p>Lectura del libro de la Sabiduría</p>
//	  <p>Sabiduría 12, 13. 16-19</p>                  ← citation
//	  <p>No hay más Dios que tú…</p>
//	  <p>Segunda lectura</p> …
//	</section>
//	<section><h2>Evangelio del Día</h2> …</section>
//
// The page carries the first reading, the second reading when the day has
// one, and the gospel. It does NOT publish the responsorial psalm or the
// alleluia verse. Texts are from the Mexican lectionary (CEM); only the
// citations are captured. Archive coverage: ~2018 through roughly three
// months ahead of today.
const (
	VaticanNewsBaseURL       = "https://www.vaticannews.va/es/evangelio-de-hoy/"
	VaticanNewsLanguageCode  = "es"
	VaticanNewsTranslationID = "vaticannews_cem"

	// Politeness delay between page downloads.
	vnRequestDelay = 300 * time.Millisecond

	vnFetchAttempts = 3
	vnRetryDelay    = 2 * time.Second
)

// VaticanNewsReadingsURL builds the print page URL for one date.
func VaticanNewsReadingsURL(date time.Time) string {
	return VaticanNewsBaseURL + date.Format("2006/01/02") + ".print.html"
}

// vnCitation matches a citation paragraph ("Apocalipsis 11, 19; 12, 1-6. 10",
// "1 Corintios 15, 20-27") and nothing longer — body paragraphs contain
// punctuation this charset excludes.
var vnCitation = regexp.MustCompile(`^([123]\s+)?\p{L}[\p{L} ]*\s[\d][\d\sa-d.,;:–—-]*$`)

// VaticanNewsScraper downloads daily readings for a date range. The Fetcher
// is injected; lengths (optional) lets cross-chapter citations expand.
type VaticanNewsScraper struct {
	fetcher Fetcher
	lengths ChapterLengths
}

func NewVaticanNewsScraper(fetcher Fetcher, lengths ChapterLengths) *VaticanNewsScraper {
	return &VaticanNewsScraper{fetcher: fetcher, lengths: lengths}
}

// ScrapeReadings downloads every date in [from, to] and returns ONE
// daily_readings document. Dates in skip (ISO strings) are not fetched —
// pass the days of a previous partial run to resume it. progress (optional)
// receives one line per day.
func (s *VaticanNewsScraper) ScrapeReadings(ctx context.Context, from, to time.Time, skip map[string]bool, progress func(string)) (*model.Document, error) {
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
		LanguageCode:  VaticanNewsLanguageCode,
		TranslationID: VaticanNewsTranslationID,
		StartYear:     int64(from.Year()),
		SourceURL:     VaticanNewsBaseURL,
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
			time.Sleep(vnRequestDelay)
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
func (s *VaticanNewsScraper) scrapeDay(ctx context.Context, date time.Time) (*model.DayReadings, []string, error) {
	url := VaticanNewsReadingsURL(date)
	body, err := fetchWithRetry(ctx, s.fetcher, url, vnFetchAttempts, vnRetryDelay)
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
		Title:     strings.TrimSpace(page.Find("div.indicazioneLiturgica span").First().Text()),
		SourceURL: url,
	}

	var warnings []string
	page.Find("section").Each(func(_ int, section *goquery.Selection) {
		heading := normalizeBookName(section.Find("h2").First().Text())
		isReadings := strings.Contains(heading, "lectura del dia")
		isGospel := strings.Contains(heading, "evangelio del dia")
		if !isReadings && !isGospel {
			return
		}

		// Walk the paragraphs: "Primera/Segunda lectura" labels set the
		// type of the next citation; a citation paragraph emits a reading.
		pending := ""
		emitted := 0
		section.Find("p").Each(func(_ int, p *goquery.Selection) {
			text := strings.TrimSpace(strings.Join(strings.Fields(p.Text()), " "))
			switch normalizeBookName(text) {
			case "primera lectura":
				pending = "reading_1"
				return
			case "segunda lectura":
				pending = "reading_2"
				return
			}
			if len(text) > 60 || !vnCitation.MatchString(text) {
				return
			}

			readingType := pending
			if isGospel {
				readingType = "gospel"
			} else if readingType == "" {
				readingType = "reading_1"
				if emitted > 0 {
					readingType = fmt.Sprintf("reading_%d", emitted+1)
				}
			}
			pending = ""
			emitted++

			reading := model.Reading{Type: readingType, Reference: text}
			ids, err := ExpandReferenceES(text, s.lengths)
			if err != nil {
				warnings = append(warnings, fmt.Sprintf("%s %q: %v", readingType, text, err))
			}
			reading.VerseIDs = ids
			day.Readings = append(day.Readings, reading)
		})
	})

	if len(day.Readings) == 0 {
		return nil, nil, fmt.Errorf("no readings found at %s — page layout may have changed", url)
	}
	return day, warnings, nil
}
