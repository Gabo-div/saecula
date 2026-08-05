package scrape

import (
	"context"
	"fmt"
	"html"
	"io"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"saecula/cli/internal/model"
)

// Catechism of the Catholic Church, English, from the St. Charles Borromeo
// parish transcription (scborromeo.org) — a flat, stable HTML mirror where
// every numbered paragraph is anchored as `<A NAME=27></A>`. Paragraphs are
// numbered 1–2865 across ~110 section pages linked from one table of contents.
const (
	cccBaseURL       = "https://www.scborromeo.org/ccc/"
	cccTOCURL        = cccBaseURL + "ccc_toc.htm"
	cccTranslationID = "ccc_scborromeo_en"
	cccLanguageCode  = "en"
	cccPromulgatedYr = 1992 // Fidei Depositum
	cccFetchAttempts = 3
	cccRetryDelay    = 2 * time.Second
)

// CatechismScraper walks the table of contents and extracts every numbered
// paragraph. Cross-references to Scripture are footnotes on the source and
// are not resolved to verse IDs yet.
// ponytail: RelatedVerses left empty — footnote→entity-ID mapping is a
// separate pass; add it when the graph needs CCC→Verse CITES edges.
type CatechismScraper struct {
	fetcher Fetcher
}

func NewCatechismScraper(fetcher Fetcher) *CatechismScraper {
	return &CatechismScraper{fetcher: fetcher}
}

var (
	cccHrefRe   = regexp.MustCompile(`(?i)href=["']?([a-z0-9_]+\.htm)`)
	cccMarkerRe = regexp.MustCompile(`(?i)<a\s+name=(\d+)\s*>`)
	cccAnyName  = regexp.MustCompile(`(?i)<a\s+name=`)
	cccHrRe     = regexp.MustCompile(`(?i)<hr`)
	cccSupRe    = regexp.MustCompile(`(?is)<sup.*?</sup>`)
	cccTagRe    = regexp.MustCompile(`<[^>]+>`)
	cccWsRe     = regexp.MustCompile(`\s+`)
)

func (s *CatechismScraper) ScrapeCatechism(ctx context.Context, progress func(string)) (*model.Document, error) {
	pages, err := s.tocPages(ctx)
	if err != nil {
		return nil, err
	}
	progress(fmt.Sprintf("%d content pages listed", len(pages)))

	seen := map[int]bool{}
	var paragraphs []model.CatechismParagraph
	for _, page := range pages {
		body, err := fetchWithRetry(ctx, s.fetcher, cccBaseURL+page, cccFetchAttempts, cccRetryDelay)
		if err != nil {
			return nil, fmt.Errorf("fetch %s: %w", page, err)
		}
		raw, err := io.ReadAll(body)
		body.Close()
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", page, err)
		}

		found := 0
		for _, p := range parseCatechismParagraphs(string(raw)) {
			if seen[p.OfficialNumber] {
				continue // a number can be repeated as a cross-reference anchor
			}
			seen[p.OfficialNumber] = true
			paragraphs = append(paragraphs, p)
			found++
		}
		if found > 0 {
			progress(fmt.Sprintf("%-14s %4d paragraphs", page, found))
		}
	}

	if len(paragraphs) == 0 {
		return nil, fmt.Errorf("no paragraphs parsed — source layout may have changed")
	}
	sort.Slice(paragraphs, func(i, j int) bool {
		return paragraphs[i].OfficialNumber < paragraphs[j].OfficialNumber
	})

	end := int64(cccPromulgatedYr)
	return &model.Document{
		Type:          model.TypeCatechism,
		LanguageCode:  cccLanguageCode,
		TranslationID: cccTranslationID,
		StartYear:     cccPromulgatedYr,
		EndYear:       &end,
		Era:           "Modern",
		SourceURL:     cccTOCURL,
		ScrapedAt:     time.Now().UTC().Format(time.RFC3339),
		Paragraphs:    paragraphs,
	}, nil
}

// tocPages returns the ordered, de-duplicated list of section page filenames
// linked from the table of contents (skipping the index and the TOC itself).
func (s *CatechismScraper) tocPages(ctx context.Context) ([]string, error) {
	body, err := fetchWithRetry(ctx, s.fetcher, cccTOCURL, cccFetchAttempts, cccRetryDelay)
	if err != nil {
		return nil, fmt.Errorf("fetch toc: %w", err)
	}
	defer body.Close()
	raw, err := io.ReadAll(body)
	if err != nil {
		return nil, fmt.Errorf("read toc: %w", err)
	}

	var pages []string
	seen := map[string]bool{}
	for _, m := range cccHrefRe.FindAllStringSubmatch(string(raw), -1) {
		page := m[1]
		if page == "ccc_toc.htm" || seen[page] {
			continue
		}
		seen[page] = true
		pages = append(pages, page)
	}
	if len(pages) == 0 {
		return nil, fmt.Errorf("no pages found in table of contents")
	}
	return pages, nil
}

// parseCatechismParagraphs extracts every `<A NAME=27></A> … text …` block
// from one page. Text runs from a numeric NAME anchor to the next NAME anchor
// (numeric or a section heading), so trailing headers are dropped.
func parseCatechismParagraphs(page string) []model.CatechismParagraph {
	locs := cccMarkerRe.FindAllStringSubmatchIndex(page, -1)
	var out []model.CatechismParagraph
	for _, loc := range locs {
		number, err := strconv.Atoi(page[loc[2]:loc[3]])
		if err != nil {
			continue
		}
		rest := page[loc[1]:]
		if next := cccAnyName.FindStringIndex(rest); next != nil {
			rest = rest[:next[0]]
		}
		// The last paragraph on a page is followed by its footnote list and
		// page navigation, both after an <hr> — cut them off.
		if hr := cccHrRe.FindStringIndex(rest); hr != nil {
			rest = rest[:hr[0]]
		}
		text := cleanCatechismText(rest, number)
		if text != "" {
			out = append(out, model.CatechismParagraph{OfficialNumber: number, Text: text})
		}
	}
	return out
}

func cleanCatechismText(chunk string, number int) string {
	chunk = cccSupRe.ReplaceAllString(chunk, "")  // drop footnote superscripts
	chunk = cccTagRe.ReplaceAllString(chunk, " ") // strip remaining tags
	chunk = html.UnescapeString(chunk)
	chunk = cccWsRe.ReplaceAllString(chunk, " ")
	chunk = strings.TrimSpace(chunk)
	// The paragraph text is prefixed by its own number (the bold anchor).
	chunk = strings.TrimSpace(strings.TrimPrefix(chunk, strconv.Itoa(number)))
	return chunk
}
