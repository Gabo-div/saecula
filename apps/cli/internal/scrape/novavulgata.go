package scrape

import (
	"context"
	"fmt"
	"html"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"

	"saecula/canon"
	"saecula/cli/internal/model"
)

// Nova Vulgata (Bibliorum Sacrorum Editio), the Holy See's official Latin
// Bible, from vatican.va. One HTML page per book, all chapters inline.
//
// Markup (one book page):
//
//	<b><a name="1"><font color="#663300">1</font></a></b>   ← chapter marker
//	<br />1 In principio creavit Deus...                     ← verse 1
//	<br />2 Terra autem erat inanis...                       ← verse 2
//
// Chapter anchors are numeric ("1") for most books and "PSALMUS N" for the
// Psalms; other name-anchors ("LIBER I …", section headers) are not pure
// numbers and are ignored. Verses are <br />-delimited lines that open with
// their number; poetry lines with no leading number continue the current
// verse. The versification is modern (Hebrew), aligning with the CEE Spanish.
const (
	NVBaseURL       = "https://www.vatican.va/archive/bible/nova_vulgata/documents/"
	NVLanguageCode  = "la"
	NVTranslationID = "nova_vulgata"

	nvRequestDelay = 300 * time.Millisecond
)

var (
	// Chapter markers: <a name="1"> or <a name="PSALMUS 1">. The trailing
	// digits are the chapter number.
	nvChapterAnchor = regexp.MustCompile(`(?i)<a\s+name="((?:PSALMUS\s+)?\d+)"`)
	// Verse lines are <br />-delimited; also break on paragraph boundaries
	// so a title glued to verse 1 in one <p> (e.g. Philemon) separates.
	nvBR  = regexp.MustCompile(`(?i)<br\s*/?>|</?p\b[^>]*>`)
	nvTag = regexp.MustCompile(`<[^>]+>`)
	nvWS  = regexp.MustCompile(`\s+`)
	// Start of the bottom chapter-nav that follows the last chapter.
	nvNavStart      = regexp.MustCompile(`(?i)<a[^>]*href="#`)
	nvTrailingDigit = regexp.MustCompile(`\d+`)
	// Book title lives in the page's meta description:
	// "LIBER GENESIS - Nova Vulgata, Vetus Testamentum".
	nvMetaDesc = regexp.MustCompile(`(?i)<meta\s+name="description"\s+content="([^"]*)"`)
)

// nvStemByCode maps every canonical USFM code to its Nova Vulgata document
// stem (the "<vt|nt>_<latin-slug>" middle of the filename). Keys cover the
// full 73-book canon.
var nvStemByCode = map[string]string{
	"GEN": "vt_genesis", "EXO": "vt_exodus", "LEV": "vt_leviticus", "NUM": "vt_numeri",
	"DEU": "vt_deuteronomii", "JOS": "vt_iosue", "JDG": "vt_iudicum", "RUT": "vt_ruth",
	"1SA": "vt_i-samuelis", "2SA": "vt_ii-samuelis", "1KI": "vt_i-regum", "2KI": "vt_ii-regum",
	"1CH": "vt_i-paralipomenon", "2CH": "vt_ii-paralipomenon", "EZR": "vt_esdrae", "NEH": "vt_nehemiae",
	"TOB": "vt_thobis", "JDT": "vt_iudith", "EST": "vt_esther",
	"1MA": "vt_i-maccabaeorum", "2MA": "vt_ii-maccabaeorum",
	"JOB": "vt_iob", "PSA": "vt_psalmorum", "PRO": "vt_proverbiorum", "ECC": "vt_ecclesiastes",
	"SNG": "vt_canticum-canticorum", "WIS": "vt_sapientiae", "SIR": "vt_ecclesiasticus",
	"ISA": "vt_isaiae", "JER": "vt_ieremiae", "LAM": "vt_lamentationes", "BAR": "vt_baruch",
	"EZK": "vt_ezechielis", "DAN": "vt_danielis", "HOS": "vt_osee", "JOL": "vt_ioel",
	"AMO": "vt_amos", "OBA": "vt_abdiae", "JON": "vt_ionae", "MIC": "vt_michaeae",
	"NAM": "vt_nahum", "HAB": "vt_habacuc", "ZEP": "vt_sophoniae", "HAG": "vt_aggaei",
	"ZEC": "vt_zachariae", "MAL": "vt_malachiae",
	"MAT": "nt_evang-matthaeum", "MRK": "nt_evang-marcum", "LUK": "nt_evang-lucam", "JHN": "nt_evang-ioannem",
	"ACT": "nt_actus-apostolorum", "ROM": "nt_epist-romanos",
	"1CO": "nt_epist-i-corinthios", "2CO": "nt_epist-ii-corinthios", "GAL": "nt_epist-galatas",
	"EPH": "nt_epist-ephesios", "PHP": "nt_epist-philippenses", "COL": "nt_epist-colossenses",
	"1TH": "nt_epist-i-thessalonicenses", "2TH": "nt_epist-ii-thessalonicenses",
	"1TI": "nt_epist-i-timotheum", "2TI": "nt_epist-ii-timotheum", "TIT": "nt_epist-titum",
	"PHM": "nt_epist-philemonem", "HEB": "nt_epist-hebraeos", "JAS": "nt_epist-iacobi",
	"1PE": "nt_epist-i-petri", "2PE": "nt_epist-ii-petri",
	"1JN": "nt_epist-i-ioannis", "2JN": "nt_epist-ii-ioannis", "3JN": "nt_epist-iii-ioannis",
	"JUD": "nt_epist-iudae", "REV": "nt_apocalypsis-ioannis",
}

// NVBookURL builds a book page URL from its document stem.
func NVBookURL(stem string) string {
	return NVBaseURL + "nova-vulgata_" + stem + "_lt.html"
}

// NovaVulgataScraper downloads the complete Nova Vulgata. Fetcher injected.
type NovaVulgataScraper struct {
	fetcher Fetcher
}

func NewNovaVulgataScraper(fetcher Fetcher) *NovaVulgataScraper {
	return &NovaVulgataScraper{fetcher: fetcher}
}

// ScrapeBible downloads every book and returns ONE document holding the
// whole Bible. progress (optional) receives one line per book.
func (s *NovaVulgataScraper) ScrapeBible(ctx context.Context, progress func(string)) (*model.Document, error) {
	report := func(msg string) {
		if progress != nil {
			progress(msg)
		}
	}

	doc := &model.Document{
		Type:          model.TypeBible,
		LanguageCode:  NVLanguageCode,
		TranslationID: NVTranslationID,
		SourceURL:     NVBaseURL,
		ScrapedAt:     time.Now().UTC().Format(time.RFC3339),
	}

	for i, book := range canon.Books {
		stem, ok := nvStemByCode[book.Code]
		if !ok {
			report(fmt.Sprintf("[%d/%d] %s: no Nova Vulgata mapping, skipped", i+1, len(canon.Books), book.Code))
			continue
		}

		if len(doc.Books) > 0 {
			time.Sleep(nvRequestDelay)
		}
		name, chapters, skipped, err := s.fetchBook(ctx, stem)
		if err != nil {
			return nil, fmt.Errorf("%s (%s): %w", book.Code, stem, err)
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
			Chapters:  chapters,
		}
		doc.Books = append(doc.Books, payload)

		verses := 0
		for _, c := range chapters {
			verses += len(c.Verses)
		}
		line := fmt.Sprintf("[%d/%d] %s (%s): %d chapters, %d verses",
			i+1, len(canon.Books), book.Code, book.NameEN, len(chapters), verses)
		if skipped > 0 {
			line += fmt.Sprintf(" (%d duplicate verse markers skipped)", skipped)
		}
		report(line)
	}

	if len(doc.Books) == 0 {
		return nil, fmt.Errorf("no books scraped")
	}
	return doc, nil
}

// fetchBook downloads one book page and parses its chapters. Returns the
// chapters and the count of duplicate verse numbers dropped (the LXX
// addition sub-verses, e.g. Esther's 1a/1b, are kept-first like the CEE
// scraper, so entity IDs never collide).
func (s *NovaVulgataScraper) fetchBook(ctx context.Context, stem string) (string, []model.ChapterPayload, int, error) {
	url := NVBookURL(stem)
	body, err := fetchWithRetry(ctx, s.fetcher, url, cccFetchAttempts, cccRetryDelay)
	if err != nil {
		return "", nil, 0, fmt.Errorf("fetch %s: %w", url, err)
	}
	defer func() { _ = body.Close() }()

	raw, err := io.ReadAll(body)
	if err != nil {
		return "", nil, 0, fmt.Errorf("read %s: %w", url, err)
	}
	page := string(raw)
	chapters, skipped, err := parseNVBook(page, url)
	return nvBookName(page), chapters, skipped, err
}

// nvBookName pulls the book title from the page's meta description, keeping
// the part before " - Nova Vulgata".
func nvBookName(page string) string {
	m := nvMetaDesc.FindStringSubmatch(page)
	if m == nil {
		return ""
	}
	name := html.UnescapeString(m[1])
	if i := strings.Index(name, " - "); i >= 0 {
		name = name[:i]
	}
	return strings.TrimSpace(name)
}

func parseNVBook(page, url string) ([]model.ChapterPayload, int, error) {
	// Scripture chapter markers are <a name="N"> anchors; the chapter index
	// and the bottom navigation are <a href="#N"> links. Verses that follow
	// each anchor carry no in-page "#" link, so the trailing nav/footer
	// begins at the first href="#" after the last chapter anchor — trim it,
	// otherwise its numbered links parse as bogus verses of the last chapter.
	marks := nvChapterAnchor.FindAllStringSubmatchIndex(page, -1)
	if len(marks) == 0 {
		// Single-chapter books (Obadiah, Philemon, 2/3 John, Jude) have no
		// chapter anchor. The header ends at FINE TESTO on pages that carry
		// it; where it doesn't (Philemon), the paragraph-aware split drops
		// the title anyway. No href trim here: these pages have no bottom
		// chapter-nav, and the header's empty "#" back-to-top link would
		// otherwise cut the scripture.
		body := page
		if i := strings.LastIndex(body, "<!--FINE TESTO-->"); i >= 0 {
			body = body[i:]
		}
		verses, dropped := parseNVChapter(body)
		if len(verses) == 0 {
			return nil, 0, fmt.Errorf("no verses parsed at %s — page layout may have changed", url)
		}
		return []model.ChapterPayload{{Number: 1, Verses: verses}}, dropped, nil
	}

	lastStart := marks[len(marks)-1][1]
	if loc := nvNavStart.FindStringIndex(page[lastStart:]); loc != nil {
		page = page[:lastStart+loc[0]]
	}

	var (
		chapters []model.ChapterPayload
		skipped  int
	)
	for i, m := range marks {
		chNum, _ := strconv.Atoi(nvTrailingDigit.FindString(page[m[2]:m[3]]))
		start := m[1]
		end := len(page)
		if i+1 < len(marks) {
			end = marks[i+1][0]
		}

		verses, dropped := parseNVChapter(page[start:end])
		skipped += dropped
		if len(verses) == 0 {
			continue
		}
		chapters = append(chapters, model.ChapterPayload{Number: chNum, Verses: verses})
	}
	if len(chapters) == 0 {
		return nil, 0, fmt.Errorf("no verses parsed at %s — page layout may have changed", url)
	}
	return chapters, skipped, nil
}

// parseNVChapter turns one chapter's HTML slice into verses. Each <br />
// segment that opens with a number starts a verse; segments without a
// leading number continue the current verse (poetry). Duplicate verse
// numbers (LXX addition sub-verses) keep the first and are counted.
func parseNVChapter(body string) ([]model.Verse, int) {
	var (
		verses  []model.Verse
		seen    = map[int]bool{}
		cur     *model.Verse
		dropped int
	)
	for _, seg := range nvBR.Split(body, -1) {
		text := nvWS.ReplaceAllString(html.UnescapeString(nvTag.ReplaceAllString(seg, "")), " ")
		text = strings.TrimSpace(text)
		if text == "" {
			continue
		}
		num, rest, ok := splitLeadingNumber(text)
		if !ok {
			if cur != nil {
				cur.Text = strings.TrimSpace(cur.Text + " " + text)
			}
			continue
		}
		if rest == "" {
			// Bare number (the chapter marker's own digit) — not a verse.
			continue
		}
		if seen[num] {
			dropped++
			continue
		}
		seen[num] = true
		verses = append(verses, model.Verse{Number: num, Text: rest})
		cur = &verses[len(verses)-1]
	}
	return verses, dropped
}

// splitLeadingNumber splits "3 Dixitque Deus" into (3, "Dixitque Deus").
func splitLeadingNumber(s string) (int, string, bool) {
	i := 0
	for i < len(s) && s[i] >= '0' && s[i] <= '9' {
		i++
	}
	if i == 0 {
		return 0, "", false
	}
	n, err := strconv.Atoi(s[:i])
	if err != nil {
		return 0, "", false
	}
	return n, strings.TrimSpace(s[i:]), true
}
