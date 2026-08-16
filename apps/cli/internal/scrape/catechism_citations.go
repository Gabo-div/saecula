package scrape

import (
	"context"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Citation is one normalized reference found in a Catechism paragraph.
// ID is the canonical, language-agnostic key (e.g. "BIBLE.MAT.10.32",
// "DOC.lumen-gentium", "SAINT.AUGUSTINE", "DS.3903", "COUNCIL.TRENT").
type Citation struct {
	Type  string `json:"type"` // scripture|document|denzinger|saint|work|council|liturgical|creed
	ID    string `json:"id"`
	Label string `json:"label,omitempty"` // human-readable name/title when known
	Ref   string `json:"ref,omitempty"`   // article/paragraph number or work reference
}

// ParagraphCitations is every citation found in one numbered paragraph.
type ParagraphCitations struct {
	Number    int        `json:"number"`
	Citations []Citation `json:"citations"`
}

// CatechismCitations is the citation scrape output for one language edition.
type CatechismCitations struct {
	LanguageCode  string               `json:"language_code"`
	TranslationID string               `json:"translation_id"`
	SourceURL     string               `json:"source_url"`
	Paragraphs    []ParagraphCitations `json:"paragraphs"`
}

// VaticanCatechismCitationsScraper extracts the citation apparatus (inline
// links and inline references) from one vatican.va edition. It intentionally
// shares the fetch/page infrastructure with the content scraper but keeps its
// own parser: it preserves <a href> links and citation patterns instead of
// reducing every paragraph to plain text.
type VaticanCatechismCitationsScraper struct {
	fetcher Fetcher
	lang    string
	cfg     vatLangCfg
}

func NewVaticanCatechismCitationsScraper(fetcher Fetcher, lang string) (*VaticanCatechismCitationsScraper, error) {
	cfg, ok := vatConfigs[lang]
	if !ok {
		return nil, fmt.Errorf("unsupported Vatican catechism language %q (want en, es or la)", lang)
	}
	return &VaticanCatechismCitationsScraper{fetcher: fetcher, lang: lang, cfg: cfg}, nil
}

// ScrapeCitations fetches every content page and returns the per-paragraph
// citations, keeping the richest match when a paragraph appears twice (a real
// paragraph always carries more citations than a stray cross-reference).
func (s *VaticanCatechismCitationsScraper) ScrapeCitations(ctx context.Context, progress func(string)) (*CatechismCitations, error) {
	stems, err := s.stems(ctx)
	if err != nil {
		return nil, err
	}
	progress(fmt.Sprintf("%d content pages listed", len(stems)))

	best := map[int]ParagraphCitations{}
	for _, stem := range stems {
		url := s.cfg.base + stem + s.cfg.suffix
		body, err := fetchWithRetry(ctx, s.fetcher, url, cccFetchAttempts, cccRetryDelay)
		if err != nil {
			if strings.Contains(err.Error(), "404") {
				continue
			}
			return nil, fmt.Errorf("fetch %s: %w", url, err)
		}
		raw, err := io.ReadAll(body)
		body.Close()
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", url, err)
		}

		for _, pc := range parseCitationParagraphs(string(raw)) {
			if ex, ok := best[pc.Number]; !ok || len(pc.Citations) > len(ex.Citations) {
				best[pc.Number] = pc
			}
		}
	}

	if len(best) == 0 {
		return nil, fmt.Errorf("no citations parsed — source layout may have changed")
	}
	out := &CatechismCitations{
		LanguageCode:  s.lang,
		TranslationID: s.cfg.translationID,
		SourceURL:     s.cfg.sourceURL,
		Paragraphs:    make([]ParagraphCitations, 0, len(best)),
	}
	for _, pc := range best {
		out.Paragraphs = append(out.Paragraphs, pc)
	}
	sort.Slice(out.Paragraphs, func(i, j int) bool { return out.Paragraphs[i].Number < out.Paragraphs[j].Number })
	return out, nil
}

// stems lists the content-page stems for this edition (same scheme as the
// content scraper: each language reads its own table of contents).
func (s *VaticanCatechismCitationsScraper) stems(ctx context.Context) ([]string, error) {
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

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

// linkRe captures an anchor and its href. href captures double-quoted URLs.
var linkRe = regexp.MustCompile(`(?is)<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>`)

// tagRe strips every HTML tag (used to derive the plain text).
var tagRe = regexp.MustCompile(`<[^>]+>`)

// supRe drops footnote superscript markers that would otherwise stick to the
// text ("text<sup>1</sup>").
var supRe = regexp.MustCompile(`(?is)<sup.*?</sup>`)

// cfGroupRe captures an inline citation list led by cf./see: "cf. Mt 10,32;
// Rom 10,9" up to the closing parenthesis or sentence end.
var cfGroupRe = regexp.MustCompile(`(?i)\b(?:cf\.?|see)\s+([^;)\n]{2,160}(?:;[^;)\n]{2,160})*)`)

// inlineScriptureRe finds a "book chapter,verse" phrase anywhere in the text,
// e.g. "(Lc 1, 48)" or "(2 Tm 1, 12)". Resolution succeeds only for real book
// names, so lookalikes ("cap 1, 1") are skipped.
var inlineScriptureRe = regexp.MustCompile(`(?i)(^|[\s(;])((?:[1-3][\s.])?[a-záéíóúñü]{2,}(?:[\s.][a-záéíóúñü]{2,}){0,2})\s+(\d{1,3})\s*[,.]\s*(\d{1,3}(?:[-–—]\d{1,3})?)`)

// dsRe captures a Denzinger-Schönmetzer reference: "DS 3903".
var dsRe = regexp.MustCompile(`(?i)\bDS\s+(\d+)`)

// parseCitationParagraphs splits a page into numbered paragraphs (same bold
// marker logic as the content scraper) but returns each chunk's raw HTML so
// links survive.
func parseCitationParagraphs(page string) []ParagraphCitations {
	locs := vatBoldNumRe.FindAllStringSubmatchIndex(page, -1)
	var out []ParagraphCitations
	for i, loc := range locs {
		var number int
		fallback := loc[2] < 0
		if !fallback {
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
		// Skip the front-matter cross-reference lists: a real paragraph's chunk
		// carries text before any citation, so require some meat.
		if len(tagRe.ReplaceAllString(rest, "")) < 40 {
			continue
		}
		cites := extractCitations(rest)
		if len(cites) == 0 {
			continue
		}
		out = append(out, ParagraphCitations{Number: number, Citations: cites})
	}
	return out
}

// extractCitations pulls every normalized citation from one paragraph chunk.
func extractCitations(html string) []Citation {
	var cites []Citation
	add := func(c Citation) { cites = append(cites, c) }
	seen := map[string]bool{}
	dedupe := func(c Citation) {
		key := c.Type + "|" + c.ID + "|" + c.Ref
		if !seen[key] {
			seen[key] = true
			cites = append(cites, c)
		}
	}

	// 1. Hyperlinked documents — the anchor text + href encode the source.
	for _, m := range linkRe.FindAllStringSubmatchIndex(html, -1) {
		href := strings.TrimSpace(html[m[2]:m[3]])
		anchor := strings.TrimSpace(tagRe.ReplaceAllString(html[m[4]:m[5]], ""))
		anchor = strings.TrimSpace(supRe.ReplaceAllString(anchor, ""))
		anchor = strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(anchor, " "))
		if anchor == "" || strings.HasPrefix(href, "#") || strings.HasPrefix(href, "/img/") {
			continue
		}
		// The reference number follows the closing anchor tag ("LG 59").
		ref := numberAfterLink(html[m[1]:])
		if doc, ok := vat2Docs[strings.ToUpper(anchor)]; ok {
			dedupe(Citation{Type: "document", ID: doc.ID, Label: doc.Title, Ref: ref})
			continue
		}
		if id, ok := canonicalDocID(href); ok {
			dedupe(Citation{Type: "document", ID: id, Label: anchor, Ref: ref})
		}
	}

	// 2. Plain text for the regex/dictionary passes.
	text := tagRe.ReplaceAllString(html, " ")
	text = htmlDecode(text)
	text = strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(text, " "))

	// 3. Scripture — cf. lists and inline "book chapter,verse" phrases resolved
	// to per-verse universal IDs.
	for _, m := range cfGroupRe.FindAllStringSubmatch(text, -1) {
		for _, seg := range strings.Split(m[1], ";") {
			for _, id := range resolveScripture(seg) {
				dedupe(Citation{Type: "scripture", ID: "BIBLE." + id, Label: strings.TrimSpace(seg)})
			}
		}
	}
	for _, m := range inlineScriptureRe.FindAllStringSubmatch(text, -1) {
		seg := strings.TrimSpace(m[2] + " " + m[3] + "," + m[4])
		for _, id := range resolveScripture(seg) {
			dedupe(Citation{Type: "scripture", ID: "BIBLE." + id})
		}
	}

	// 4. Denzinger.
	for _, m := range dsRe.FindAllStringSubmatch(text, -1) {
		dedupe(Citation{Type: "denzinger", ID: "DS." + m[1], Ref: m[1]})
	}

	// 5. Papal and other documents cited by name in plain text (not linked).
	for key, id := range papalDocIDs {
		if containsWord(text, key) {
			dedupe(Citation{Type: "document", ID: id, Label: id})
		}
	}

	// 6. Saints and their works, councils, liturgical texts — dictionary
	// substring matches (robust across name variants and editions).
	for key, id := range saintIDs {
		if containsWord(text, key) {
			add(Citation{Type: "saint", ID: id, Label: key})
		}
	}
	for key, id := range workIDs {
		if containsWord(text, key) {
			add(Citation{Type: "work", ID: id, Label: key})
		}
	}
	for key, id := range councilIDs {
		if containsWord(text, key) {
			add(Citation{Type: "council", ID: id, Label: key})
		}
	}
	for key, id := range liturgicalIDs {
		if containsWord(text, key) {
			add(Citation{Type: "liturgical", ID: id, Label: key})
		}
	}
	return cites
}

// resolveScripture resolves one inline scripture segment ("Mt 10,32" /
// "Mt 10:32") into universal verse ids, tolerating failures.
func resolveScripture(seg string) []string {
	seg = strings.TrimSpace(seg)
	if seg == "" {
		return nil
	}
	if ids, err := ExpandReferenceES(seg, nil); err == nil && len(ids) > 0 {
		return ids
	}
	if ids, err := ExpandReference(seg, "", nil); err == nil && len(ids) > 0 {
		return ids
	}
	return nil
}

// numberAfterLink returns the number immediately following a closing anchor
// tag ("...LG</a> 59" -> "59"), or "".
func numberAfterLink(rest string) string {
	rest = strings.TrimLeft(rest, " \t\n\r")
	if rest == "" {
		return ""
	}
	end := 0
	for end < len(rest) && rest[end] >= '0' && rest[end] <= '9' {
		end++
	}
	return rest[:end]
}

// containsWord reports whether a dictionary key appears in the text as a
// substring. Keys are folded, so the text is folded for the match too.
func containsWord(text, key string) bool {
	return strings.Contains(citationKey(text), citationKey(key))
}

// htmlDecode replaces the common HTML entities found on vatican.va pages.
func htmlDecode(s string) string {
	for _, ent := range []struct{ from, to string }{
		{"&aacute;", "á"}, {"&eacute;", "é"}, {"&iacute;", "í"},
		{"&oacute;", "ó"}, {"&uacute;", "ú"}, {"&ntilde;", "ñ"},
		{"&uuml;", "ü"}, {"&Aacute;", "Á"}, {"&Eacute;", "É"},
		{"&Iacute;", "Í"}, {"&Oacute;", "Ó"}, {"&Uacute;", "Ú"},
		{"&Ntilde;", "Ñ"}, {"&Uuml;", "Ü"},
		{"&quot;", "\""}, {"&laquo;", "«"}, {"&raquo;", "»"},
		{"&#x201c;", "\""}, {"&#x201d;", "\""}, {"&#x2018;", "'"}, {"&#x2019;", "'"},
		{"&nbsp;", " "}, {"&#160;", " "}, {"&amp;", "&"},
	} {
		s = strings.ReplaceAll(s, ent.from, ent.to)
	}
	return s
}
