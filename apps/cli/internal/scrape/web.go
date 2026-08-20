package scrape

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"regexp"
	"strings"
	"time"

	"saecula/canon"
	"saecula/cli/internal/model"
)

// World English Bible, Catholic Edition (WEB-CE) — public domain, from
// ebible.org. Distributed as one USFM zip (one .usfm file per book), so
// there is nothing to HTML-scrape: fetch the archive once and parse the
// standard USFM markers.
//
//	\id GEN …        book id
//	\c 3             chapter
//	\v 16 For God…   verse (text may continue on following \q/\p lines)
//	\w word|strong=… inline word markup (keep the word, drop the attribute)
//	\f … \f*         footnote (dropped), \x … \x* cross-reference (dropped)
//
// Versification is modern (Hebrew), aligning with the CEE Spanish. The
// Catholic edition ships the Greek Esther/Daniel under the USFM codes ESG
// and DAG; both are mapped onto the canon's EST/DAN.
const (
	WEBZipURL        = "https://ebible.org/Scriptures/eng-web-c_usfm.zip"
	WEBLanguageCode  = "en"
	WEBTranslationID = "web_ce"
)

// webCodeAlias maps the WEB-CE USFM book codes that differ from the canon.
var webCodeAlias = map[string]string{
	"ESG": "EST", // Greek Esther
	"DAG": "DAN", // Greek Daniel
}

var (
	usfmNote   = regexp.MustCompile(`(?s)\\(f|fe|x)\b.*?\\(f|fe|x)\*`)
	usfmAttrib = regexp.MustCompile(`\|[^\\]*`)          // |strong="…" (and any other attributes)
	usfmMarker = regexp.MustCompile(`\\\+?[a-z0-9]+\*?`) // \w \w* \p \q1 \nd \nd* …
	usfmWS     = regexp.MustCompile(`\s+`)
)

// WEBScraper downloads and parses the WEB-CE USFM archive. Fetcher injected.
type WEBScraper struct {
	fetcher Fetcher
}

func NewWEBScraper(fetcher Fetcher) *WEBScraper {
	return &WEBScraper{fetcher: fetcher}
}

// ScrapeBible downloads the USFM zip and returns ONE document holding the
// whole Bible. progress (optional) receives one line per book.
func (s *WEBScraper) ScrapeBible(ctx context.Context, progress func(string)) (*model.Document, error) {
	report := func(msg string) {
		if progress != nil {
			progress(msg)
		}
	}
	report("downloading the WEB-CE USFM archive…")

	body, err := fetchWithRetry(ctx, s.fetcher, WEBZipURL, cccFetchAttempts, cccRetryDelay)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", WEBZipURL, err)
	}
	raw, err := io.ReadAll(body)
	_ = body.Close()
	if err != nil {
		return nil, fmt.Errorf("read archive: %w", err)
	}
	zr, err := zip.NewReader(bytes.NewReader(raw), int64(len(raw)))
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}

	// Index the archive by canonical book code.
	byCode := make(map[string]*zip.File, len(zr.File))
	for _, f := range zr.File {
		if !strings.HasSuffix(f.Name, ".usfm") {
			continue
		}
		code, err := usfmBookCode(f)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", f.Name, err)
		}
		if alias, ok := webCodeAlias[code]; ok {
			code = alias
		}
		byCode[code] = f
	}

	doc := &model.Document{
		Type:          model.TypeBible,
		LanguageCode:  WEBLanguageCode,
		TranslationID: WEBTranslationID,
		SourceURL:     WEBZipURL,
		ScrapedAt:     time.Now().UTC().Format(time.RFC3339),
	}

	for i, book := range canon.Books {
		f, ok := byCode[book.Code]
		if !ok {
			report(fmt.Sprintf("[%d/%d] %s: not in the WEB-CE archive, skipped", i+1, len(canon.Books), book.Code))
			continue
		}
		chapters, err := parseUSFMBook(f)
		if err != nil {
			return nil, fmt.Errorf("%s (%s): %w", book.Code, f.Name, err)
		}

		payload := model.BookPayload{
			Code:      book.Code,
			Slug:      book.Slug,
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
		report(fmt.Sprintf("[%d/%d] %s (%s): %d chapters, %d verses",
			i+1, len(canon.Books), book.Code, book.NameEN, len(chapters), verses))
	}

	if len(doc.Books) == 0 {
		return nil, fmt.Errorf("no books scraped")
	}
	return doc, nil
}

// usfmBookCode reads the \id line's first token.
func usfmBookCode(f *zip.File) (string, error) {
	rc, err := f.Open()
	if err != nil {
		return "", err
	}
	defer func() { _ = rc.Close() }()
	raw, err := io.ReadAll(rc)
	if err != nil {
		return "", err
	}
	for _, line := range strings.Split(string(raw), "\n") {
		if rest, ok := strings.CutPrefix(strings.TrimSpace(line), `\id `); ok {
			return strings.ToUpper(strings.Fields(rest)[0]), nil
		}
	}
	return "", fmt.Errorf("no \\id marker")
}

// parseUSFMBook turns one book's USFM into chapters. \c starts a chapter,
// \v starts a verse; every other line's text continues the current verse
// (poetry lines, wrapped prose). Footnotes and inline markup are stripped.
func parseUSFMBook(f *zip.File) ([]model.ChapterPayload, error) {
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer func() { _ = rc.Close() }()
	raw, err := io.ReadAll(rc)
	if err != nil {
		return nil, err
	}

	var (
		chapters []model.ChapterPayload
		cur      *model.ChapterPayload
		vnum     int
		vbuf     strings.Builder
	)
	flushVerse := func() {
		if vnum == 0 || cur == nil {
			vnum = 0
			vbuf.Reset()
			return
		}
		if text := cleanUSFM(vbuf.String()); text != "" {
			cur.Verses = append(cur.Verses, model.Verse{Number: vnum, Text: text})
		}
		vnum = 0
		vbuf.Reset()
	}

	for _, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(line, `\c `):
			flushVerse()
			n, _, _ := splitLeadingNumber(strings.TrimSpace(line[3:]))
			chapters = append(chapters, model.ChapterPayload{Number: n})
			cur = &chapters[len(chapters)-1]
		case strings.HasPrefix(line, `\v `):
			flushVerse()
			n, rest, ok := splitLeadingNumber(strings.TrimSpace(line[3:]))
			if !ok {
				continue
			}
			vnum = n
			vbuf.WriteString(rest)
		default:
			if vnum != 0 {
				vbuf.WriteByte(' ')
				vbuf.WriteString(line)
			}
		}
	}
	flushVerse()

	// Drop empty chapters (front matter never reaches here, but be safe).
	kept := chapters[:0]
	for _, c := range chapters {
		if len(c.Verses) > 0 {
			kept = append(kept, c)
		}
	}
	if len(kept) == 0 {
		return nil, fmt.Errorf("no verses parsed")
	}
	return kept, nil
}

// cleanUSFM strips footnotes, cross-references and inline markup, leaving
// plain verse text.
func cleanUSFM(s string) string {
	s = usfmNote.ReplaceAllString(s, "")
	s = usfmAttrib.ReplaceAllString(s, "")
	s = usfmMarker.ReplaceAllString(s, "")
	return strings.TrimSpace(usfmWS.ReplaceAllString(s, " "))
}
