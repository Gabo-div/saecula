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

// Catechism of the Catholic Church, Spanish and Latin editions, from the Holy
// See's own site (vatican.va). Every numbered paragraph opens with a bold
// number — `<b>27</b> El deseo…` — across the same ~100 section pages the
// English edition uses. The page stems (p1s1c1, prologue, …) are identical in
// every language, so the complete list is taken once from the Spanish index
// and each stem is fetched with the target language's suffix.
const (
	vatPromulgatedYr = 1992 // Fidei Depositum
	cccFetchAttempts = 3
	cccRetryDelay    = 2 * time.Second
)

// Shared HTML-cleaning patterns.
var (
	cccTagRe = regexp.MustCompile(`<[^>]+>`)
	cccWsRe  = regexp.MustCompile(`\s+`)
	cccSupRe = regexp.MustCompile(`(?is)<sup.*?</sup>`)
)

type vatLangCfg struct {
	base          string // page base URL
	suffix        string         // appended to each pageRe capture ("" if it captures the whole filename)
	pageRe        *regexp.Regexp // extracts content-page names from the index
	translationID string
	sourceURL     string
}

// The Spanish and Latin editions share the pXsYcZ page scheme (the same stems
// in each language); English uses a flat __PN.HTM sequence — hence a per-edition
// page regex. All three number their paragraphs the same way (bold, 1–2865).
var vatConfigs = map[string]vatLangCfg{
	"en": {
		base:          "https://www.vatican.va/archive/ENG0015/",
		suffix:        "",
		pageRe:        regexp.MustCompile(`(?i)href=["']?(__P[0-9A-Z]+\.HTM)`),
		translationID: "ccc_vatican_en",
		sourceURL:     "https://www.vatican.va/archive/ENG0015/_INDEX.HTM",
	},
	"es": {
		base:          "https://www.vatican.va/archive/catechism_sp/",
		suffix:        "_sp.html",
		pageRe:        regexp.MustCompile(`(?i)href="([a-z0-9_-]+)_sp\.html`),
		translationID: "ccc_vatican_es",
		sourceURL:     "https://www.vatican.va/archive/catechism_sp/index_sp.html",
	},
	"la": {
		base:          "https://www.vatican.va/archive/catechism_lt/",
		suffix:        "_lt.htm",
		pageRe:        regexp.MustCompile(`(?i)href="([a-z0-9_-]+)_lt\.htm`),
		translationID: "ccc_vatican_la",
		sourceURL:     "https://www.vatican.va/archive/catechism_lt/index_lt.htm",
	},
}

// VaticanCatechismScraper extracts one language edition. Scripture
// cross-references are inline citations on the source and are not resolved to
// verse IDs here (see the English scraper's ponytail note).
// ponytail: ~4-5 of the 2865 paragraphs lost their bold/number markup on the
// source HTML and are skipped (coverage ≈ 99.8%). Chasing each remaining one
// needs a bespoke rule and risks false positives; add per-number recovery
// only if a specific paragraph is reported missing.
type VaticanCatechismScraper struct {
	fetcher Fetcher
	lang    string
	cfg     vatLangCfg
}

func NewVaticanCatechismScraper(fetcher Fetcher, lang string) (*VaticanCatechismScraper, error) {
	cfg, ok := vatConfigs[lang]
	if !ok {
		return nil, fmt.Errorf("unsupported Vatican catechism language %q (want en, es or la)", lang)
	}
	return &VaticanCatechismScraper{fetcher: fetcher, lang: lang, cfg: cfg}, nil
}

var (
	// A paragraph opens with its number in bold — either plain (`<b>27</b>`)
	// or anchored (`<b> <a name="1601"> 1601</a></b>`, used on some pages).
	// Some paragraphs lost their bold tag and open with a bare number right
	// after the <p>, possibly wrapped in inline formatting the source added
	// (`<p align="left">168 …`, `<p class=MsoNormal><i …>656 …`); that is the
	// second alternative and is range-guarded when parsed.
	vatBoldNumRe = regexp.MustCompile(`(?i)<b[^>]*>\s*(?:<a[^>]*>\s*)?(\d+)\s*(?:</a>)?\s*</b>|<p[^>]*>(?:\s*<[a-z][^>]*>)*\s*(\d{1,4})\s`)
	vatMaxNumber = 2865 // last CCC paragraph; guards the bare-number fallback
	// A paragraph ends at the next section heading (named anchor) or the
	// in-page navigation (fragment links like href="#top").
	vatCutRe = regexp.MustCompile(`(?i)<a\s+name|<a[^>]*href=["']#`)
)

func (s *VaticanCatechismScraper) ScrapeCatechism(ctx context.Context, progress func(string)) (*model.Document, error) {
	stems, err := s.stems(ctx)
	if err != nil {
		return nil, err
	}
	progress(fmt.Sprintf("%d content pages listed", len(stems)))

	seen := map[int]bool{}
	var paragraphs []model.CatechismParagraph
	for _, stem := range stems {
		url := s.cfg.base + stem + s.cfg.suffix
		body, err := fetchWithRetry(ctx, s.fetcher, url, cccFetchAttempts, cccRetryDelay)
		if err != nil {
			// The page decomposition differs slightly across editions (e.g. a
			// section split into extra pages in one language only). A stem that
			// doesn't exist here is skipped; other failures still abort.
			if strings.Contains(err.Error(), "404") {
				progress(fmt.Sprintf("%-16s (not in this edition)", stem))
				continue
			}
			return nil, fmt.Errorf("fetch %s: %w", stem, err)
		}
		raw, err := io.ReadAll(body)
		body.Close()
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", stem, err)
		}

		found := 0
		for _, p := range parseVaticanParagraphs(string(raw)) {
			if seen[p.OfficialNumber] {
				continue
			}
			seen[p.OfficialNumber] = true
			paragraphs = append(paragraphs, p)
			found++
		}
		if found > 0 {
			progress(fmt.Sprintf("%-16s %4d paragraphs", stem, found))
		}
	}

	if len(paragraphs) == 0 {
		return nil, fmt.Errorf("no paragraphs parsed — source layout may have changed")
	}
	sort.Slice(paragraphs, func(i, j int) bool {
		return paragraphs[i].OfficialNumber < paragraphs[j].OfficialNumber
	})

	end := int64(vatPromulgatedYr)
	return &model.Document{
		Type:          model.TypeCatechism,
		LanguageCode:  s.lang,
		TranslationID: s.cfg.translationID,
		StartYear:     vatPromulgatedYr,
		EndYear:       &end,
		Era:           "Modern",
		SourceURL:     s.cfg.sourceURL,
		ScrapedAt:     time.Now().UTC().Format(time.RFC3339),
		Paragraphs:    paragraphs,
	}, nil
}

// stems lists the de-duplicated content-page stems (without the language
// suffix) from this edition's own table of contents. Editions paginate a few
// sections differently, so each language's stems come from its own index.
// The closing quote is omitted from the pattern because some pages are only
// linked with a #fragment anchor.
func (s *VaticanCatechismScraper) stems(ctx context.Context) ([]string, error) {
	body, err := fetchWithRetry(ctx, s.fetcher, s.cfg.sourceURL, cccFetchAttempts, cccRetryDelay)
	if err != nil {
		return nil, fmt.Errorf("fetch index: %w", err)
	}
	defer body.Close()
	raw, err := io.ReadAll(body)
	if err != nil {
		return nil, fmt.Errorf("read index: %w", err)
	}

	var out []string
	seen := map[string]bool{}
	for _, m := range s.cfg.pageRe.FindAllStringSubmatch(string(raw), -1) {
		stem := m[1]
		if strings.EqualFold(stem, "index") || seen[stem] {
			continue
		}
		seen[stem] = true
		out = append(out, stem)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("no pages found in table of contents")
	}
	return out, nil
}

// parseVaticanParagraphs extracts every `<b>27</b> … text …` block from one
// page: text runs from a bold number to the next bold number, trimmed at the
// next section heading or navigation anchor.
func parseVaticanParagraphs(page string) []model.CatechismParagraph {
	// Drop footnote superscripts first (the English edition puts anchored
	// footnote marks inline, which would otherwise cut paragraphs short).
	page = cccSupRe.ReplaceAllString(page, "")
	locs := vatBoldNumRe.FindAllStringSubmatchIndex(page, -1)
	var out []model.CatechismParagraph
	for i, loc := range locs {
		// Group 1 = a bold marker (reliable); group 2 = a bare <p> number,
		// accepted only within the valid CCC range to avoid false positives.
		var number int
		if loc[2] >= 0 {
			number, _ = strconv.Atoi(page[loc[2]:loc[3]])
		} else if loc[4] >= 0 {
			n, err := strconv.Atoi(page[loc[4]:loc[5]])
			if err != nil || n < 1 || n > vatMaxNumber {
				continue
			}
			number = n
		}
		if number == 0 {
			continue
		}
		rest := page[loc[1]:]
		if i+1 < len(locs) {
			rest = page[loc[1]:locs[i+1][0]]
		}
		if cut := vatCutRe.FindStringIndex(rest); cut != nil {
			rest = rest[:cut[0]]
		}
		text := cleanVaticanText(rest, number)
		if text != "" {
			out = append(out, model.CatechismParagraph{OfficialNumber: number, Text: text})
		}
	}
	return out
}

func cleanVaticanText(chunk string, number int) string {
	chunk = cccTagRe.ReplaceAllString(chunk, " ")
	chunk = html.UnescapeString(chunk)
	chunk = cccWsRe.ReplaceAllString(chunk, " ")
	chunk = strings.TrimSpace(chunk)
	chunk = strings.TrimSpace(strings.TrimPrefix(chunk, strconv.Itoa(number)))
	return chunk
}
