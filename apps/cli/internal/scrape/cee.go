package scrape

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"

	"saecula/canon"
	"saecula/cli/internal/model"
)

// Psalms (and a few other places) carry dual Hebrew/Septuagint numbering,
// e.g. chapter "114 (113a)" or verse "1 (9)". The leading integer is the
// primary (Hebrew) number.
var leadingInt = regexp.MustCompile(`^\s*(\d+)`)

// parseLeadingInt extracts the first integer of a marker like "114 (113a)".
func parseLeadingInt(s string) (int, bool) {
	m := leadingInt.FindStringSubmatch(s)
	if m == nil {
		return 0, false
	}
	n, err := strconv.Atoi(m[1])
	return n, err == nil
}

// Sagrada Biblia de la Conferencia Episcopal Española (2011),
// https://www.conferenciaepiscopal.es/biblia/
//
// One page per book, all chapters inline:
//
//	<div class="capitulo">
//	  <span class="numcap">3<a id="cap3"></a></span>
//	  <span class="versiculos">
//	    <span class="numvers">1</span><span class="contenido">Había un hombre...</span>
//	    ...
//	  </span>
//	</div>
//
// Special case: 1–3 John share a single page ("juan-cartas-1-3") holding
// seven chapter divs — 1 John 1–5, then 2 John and 3 John (one each).
const (
	CEEBaseURL       = "https://www.conferenciaepiscopal.es/biblia/"
	CEELanguageCode  = "es"
	CEETranslationID = "cee_2011"

	// Politeness delay between page downloads.
	ceeRequestDelay = 300 * time.Millisecond

	ceeJohnLettersSlug = "juan-cartas-1-3"
)

// ceeSlugByCode maps the canonical USFM code of every canon book to its
// slug on the CEE site. Keys must exist in the bible catalog.
var ceeSlugByCode = map[string]string{
	"GEN": "genesis", "EXO": "exodo", "LEV": "levitico", "NUM": "numeros",
	"DEU": "deuteronomio", "JOS": "josue", "JDG": "jueces", "RUT": "rut",
	"1SA": "1-samuel", "2SA": "2-samuel", "1KI": "1-reyes", "2KI": "2-reyes",
	"1CH": "1-cronicas", "2CH": "2-cronicas", "EZR": "esdras", "NEH": "nehemias",
	"TOB": "tobias", "JDT": "judit", "EST": "ester",
	"1MA": "1-macabeos", "2MA": "2-macabeos",
	"JOB": "job", "PSA": "salmos", "PRO": "proverbios", "ECC": "eclesiastes",
	"SNG": "cantar-de-los-cantares", "WIS": "sabiduria", "SIR": "eclesiastico",
	"ISA": "isaias", "JER": "jeremias", "LAM": "lamentaciones", "BAR": "baruc",
	"EZK": "ezequiel", "DAN": "daniel", "HOS": "oseas", "JOL": "joel",
	"AMO": "amos", "OBA": "abdias", "JON": "jonas", "MIC": "miqueas",
	"NAM": "nahun", "HAB": "habacuc", "ZEP": "sofonias", "HAG": "ageo",
	"ZEC": "zacarias", "MAL": "malaquias",
	"MAT": "mateo", "MRK": "marcos", "LUK": "lucas", "JHN": "juan",
	"ACT": "hechos-de-los-apostoles", "ROM": "romanos",
	"1CO": "1-corintios", "2CO": "2-corintios", "GAL": "galatas",
	"EPH": "efesios", "PHP": "filipenses", "COL": "colosenses",
	"1TH": "1-tesalonicenses", "2TH": "2-tesalonicenses",
	"1TI": "1-timoteo", "2TI": "2-timoteo", "TIT": "tito", "PHM": "filemon",
	"HEB": "hebreos", "JAS": "santiago", "1PE": "1-pedro", "2PE": "2-pedro",
	"1JN": ceeJohnLettersSlug, "2JN": ceeJohnLettersSlug, "3JN": ceeJohnLettersSlug,
	"JUD": "judas", "REV": "apocalipsis",
}

// CEEBookURL builds the book page URL from the site's own slug.
func CEEBookURL(ceeSlug string) string {
	return CEEBaseURL + strings.Trim(ceeSlug, "/") + "/"
}

// CEEScraper downloads the complete CEE Bible. The Fetcher is injected.
type CEEScraper struct {
	fetcher Fetcher
}

func NewCEEScraper(fetcher Fetcher) *CEEScraper {
	return &CEEScraper{fetcher: fetcher}
}

// ScrapeBible downloads every book of the canon and returns ONE document
// holding the whole Bible. progress (optional) receives one line per book.
func (s *CEEScraper) ScrapeBible(ctx context.Context, progress func(string)) (*model.Document, error) {
	report := func(msg string) {
		if progress != nil {
			progress(msg)
		}
	}

	doc := &model.Document{
		Type:          model.TypeBible,
		LanguageCode:  CEELanguageCode,
		TranslationID: CEETranslationID,
		SourceURL:     CEEBaseURL,
		ScrapedAt:     time.Now().UTC().Format(time.RFC3339),
	}

	// Pages that hold several books (John's letters) are fetched once and
	// their chapters distributed positionally.
	pageCache := map[string]parsedPage{}

	for i, book := range canon.Books {
		ceeSlug, ok := ceeSlugByCode[book.Code]
		if !ok {
			report(fmt.Sprintf("[%d/%d] %s: no CEE mapping, skipped", i+1, len(canon.Books), book.Code))
			continue
		}

		page, cached := pageCache[ceeSlug]
		if !cached {
			if len(pageCache) > 0 || len(doc.Books) > 0 {
				time.Sleep(ceeRequestDelay)
			}
			var err error
			page, err = s.fetchBookPage(ctx, ceeSlug)
			if err != nil {
				return nil, fmt.Errorf("%s (%s): %w", book.Code, ceeSlug, err)
			}
			pageCache[ceeSlug] = page
		}
		chapters := page.chapters

		bookChapters := chapters
		if ceeSlug == ceeJohnLettersSlug {
			var err error
			bookChapters, err = sliceJohnLetters(chapters, book.Code)
			if err != nil {
				return nil, err
			}
		}

		// The combined 1–3 John page has one shared title, so it can't name
		// the individual letters — fall back to the catalog there.
		name := ceeBookName(page.title)
		if name == "" || ceeSlug == ceeJohnLettersSlug {
			name = book.NameES
		}

		payload := model.BookPayload{
			Code:      book.Code,
			Slug:      book.Slug,
			Name:      name,
			NameEN:    book.NameEN,
			NameES:    book.NameES,
			Testament: book.Testament,
			StartYear: book.StartYear,
			EndYear:   book.EndYear,
			Era:       book.Era,
		}
		verseTotal := 0
		for _, ch := range bookChapters {
			payload.Chapters = append(payload.Chapters, model.ChapterPayload{
				Number: ch.number,
				Verses: ch.verses,
			})
			verseTotal += len(ch.verses)
		}
		doc.Books = append(doc.Books, payload)

		line := fmt.Sprintf("[%d/%d] %s (%s): %d chapters, %d verses",
			i+1, len(canon.Books), book.Code, book.NameES, len(payload.Chapters), verseTotal)
		if page.skippedVariants > 0 && ceeSlug != ceeJohnLettersSlug {
			line += fmt.Sprintf(" (%d variant/duplicate verse markers skipped)", page.skippedVariants)
		}
		report(line)
	}

	if len(doc.Books) == 0 {
		return nil, fmt.Errorf("no books scraped")
	}
	return doc, nil
}

// parsedChapter is one div.capitulo: its displayed number and verses.
type parsedChapter struct {
	number int
	verses []model.Verse
}

// parsedPage is one downloaded book page after normalization.
type parsedPage struct {
	chapters []parsedChapter
	title    string // raw <title>, e.g. "Pentateuco: 1. Génesis - Conferencia…"
	// verse markers dropped because their number repeated within a
	// chapter (inline LXX variants / Greek additions).
	skippedVariants int
}

// ceeBookName pulls the book name out of the page <title>, which reads
// "<section><sep> <n>. <book> - Conferencia Episcopal Española" where <sep>
// is ":" or "." (e.g. "Pentateuco: 1. Génesis" → "Génesis",
// "Evangelios. 1. Mateo" → "Mateo"). Returns "" if it can't.
func ceeBookName(title string) string {
	name := title
	if i := strings.Index(name, " - "); i >= 0 {
		name = name[:i] // drop the "- Conferencia Episcopal Española" suffix
	}
	name = ceeSectionPrefix.ReplaceAllString(name, "") // "Pentateuco: 1. "
	name = ceeTrailingNum.ReplaceAllString(name, "")   // stray "…apocalipsis 1"
	return strings.TrimSpace(name)
}

var (
	ceeSectionPrefix = regexp.MustCompile(`^.*?[:.]\s*\d+\.\s*`)
	ceeTrailingNum   = regexp.MustCompile(`\s+\d+$`)
)

// fetchBookPage downloads one book page, parses every chapter div in page
// order, then normalizes:
//
//  1. A div can hold SEVERAL chapters (Psalms 9+10 share one div numbered
//     "9"; the next div is "11"). Detected by the gap in div numbering and
//     split at the verse-number restarts.
//  2. A chapter can contain inline textual variants whose verse numbers
//     repeat (1 Kings 11, Acts 24, Esther's Greek additions, Isaiah 38).
//     The first occurrence of each verse number wins; repeats are dropped
//     and counted.
func (s *CEEScraper) fetchBookPage(ctx context.Context, ceeSlug string) (parsedPage, error) {
	url := CEEBookURL(ceeSlug)
	body, err := s.fetcher.Fetch(ctx, url)
	if err != nil {
		return parsedPage{}, fmt.Errorf("fetch %s: %w", url, err)
	}
	defer func() { _ = body.Close() }()

	page, err := goquery.NewDocumentFromReader(body)
	if err != nil {
		return parsedPage{}, fmt.Errorf("parse html: %w", err)
	}

	var (
		raw      []parsedChapter
		parseErr error
	)
	page.Find("div.capitulo").Each(func(idx int, div *goquery.Selection) {
		if parseErr != nil {
			return
		}
		number, ok := parseLeadingInt(div.Find("span.numcap").First().Text())
		if !ok {
			// Fall back to position when the number span is unreadable.
			number = idx + 1
		}

		verses, err := parseVerses(div)
		if err != nil {
			parseErr = fmt.Errorf("chapter %d: %w", number, err)
			return
		}
		raw = append(raw, parsedChapter{number: number, verses: verses})
	})
	if parseErr != nil {
		return parsedPage{}, parseErr
	}
	if len(raw) == 0 {
		return parsedPage{}, fmt.Errorf("no div.capitulo found at %s — page layout may have changed", url)
	}

	out := normalizeChapters(raw)
	out.title = strings.TrimSpace(page.Find("title").First().Text())
	return out, nil
}

// normalizeChapters applies the multi-chapter-div split and the
// duplicate-verse dedupe described on fetchBookPage.
func normalizeChapters(raw []parsedChapter) parsedPage {
	var out parsedPage
	for i, ch := range raw {
		gap := 1
		if i+1 < len(raw) && raw[i+1].number > ch.number {
			gap = raw[i+1].number - ch.number
		}

		runs := splitAscendingRuns(ch.verses)
		if gap > 1 && len(runs) == gap {
			// The runs exactly fill the numbering gap: several chapters
			// share this div.
			for offset, run := range runs {
				out.chapters = append(out.chapters, parsedChapter{number: ch.number + offset, verses: run})
			}
			continue
		}

		// One chapter: keep the first occurrence of each verse number.
		seen := make(map[int]bool, len(ch.verses))
		kept := ch.verses[:0]
		for _, v := range ch.verses {
			if seen[v.Number] {
				out.skippedVariants++
				continue
			}
			seen[v.Number] = true
			kept = append(kept, v)
		}
		out.chapters = append(out.chapters, parsedChapter{number: ch.number, verses: kept})
	}
	return out
}

// parseVerses extracts the numvers/contenido pairs of one chapter div.
func parseVerses(div *goquery.Selection) ([]model.Verse, error) {
	var (
		verses   []model.Verse
		parseErr error
	)
	div.Find("span.numvers").Each(func(_ int, numSel *goquery.Selection) {
		if parseErr != nil {
			return
		}
		number, ok := parseLeadingInt(numSel.Text())
		if !ok {
			return // decorative or malformed marker; skip
		}
		content := numSel.Next()
		if !content.HasClass("contenido") {
			parseErr = fmt.Errorf("verse %d: expected span.contenido after span.numvers — page layout may have changed", number)
			return
		}
		text := strings.TrimSpace(strings.Join(strings.Fields(content.Text()), " "))
		if text == "" {
			return
		}
		verses = append(verses, model.Verse{Number: number, Text: text})
	})
	if parseErr != nil {
		return nil, parseErr
	}
	if len(verses) == 0 {
		return nil, fmt.Errorf("no verses found")
	}
	return verses, nil
}

// splitAscendingRuns cuts a verse list wherever the numbering restarts
// (verse number <= its predecessor). A well-formed chapter is one run.
func splitAscendingRuns(verses []model.Verse) [][]model.Verse {
	var runs [][]model.Verse
	start := 0
	for i := 1; i < len(verses); i++ {
		if verses[i].Number <= verses[i-1].Number {
			runs = append(runs, verses[start:i])
			start = i
		}
	}
	return append(runs, verses[start:])
}

// sliceJohnLetters splits the combined 1–3 John page. The page holds
// 1 John's chapters first (numbered 1..n ascending), then one chapter div
// per remaining letter.
func sliceJohnLetters(chapters []parsedChapter, code string) ([]parsedChapter, error) {
	// End of the first ascending run = end of 1 John.
	firstEnd := len(chapters)
	for i := 1; i < len(chapters); i++ {
		if chapters[i].number <= chapters[i-1].number {
			firstEnd = i
			break
		}
	}

	switch code {
	case "1JN":
		return chapters[:firstEnd], nil
	case "2JN":
		if firstEnd >= len(chapters) {
			return nil, fmt.Errorf("2JN: combined John letters page has no second section")
		}
		return []parsedChapter{{number: 1, verses: chapters[firstEnd].verses}}, nil
	case "3JN":
		if firstEnd+1 >= len(chapters) {
			return nil, fmt.Errorf("3JN: combined John letters page has no third section")
		}
		return []parsedChapter{{number: 1, verses: chapters[firstEnd+1].verses}}, nil
	default:
		return nil, fmt.Errorf("unexpected code %s for combined John letters page", code)
	}
}
