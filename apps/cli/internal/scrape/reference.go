package scrape

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"saecula/canon"

	"saecula/cli/internal/model"
)

// ChapterLengths maps book code → chapter number → last verse number.
// Used to expand cross-chapter citations ("Genesis 1:1—2:2"); built from
// any already-scraped bible document.
type ChapterLengths map[string]map[int]int

// ChapterLengthsFromBible derives ChapterLengths from a TypeBible document.
func ChapterLengthsFromBible(doc *model.Document) ChapterLengths {
	lengths := ChapterLengths{}
	for _, b := range doc.Books {
		chapters := map[int]int{}
		for _, ch := range b.Chapters {
			last := 0
			for _, v := range ch.Verses {
				if v.Number > last {
					last = v.Number
				}
			}
			chapters[ch.Number] = last
		}
		lengths[b.Code] = chapters
	}
	return lengths
}

// singleChapterBooks are cited without a chapter number ("Jude 17, 20-25").
var singleChapterBooks = map[string]bool{
	"OBA": true, "PHM": true, "2JN": true, "3JN": true, "JUD": true,
}

// bookAliases maps normalized book names — canon English names plus the
// abbreviations USCCB prints — to USFM codes. Keys are normalizeBookName'd.
var bookAliases = func() map[string]string {
	m := map[string]string{}
	for _, b := range canon.Books {
		m[normalizeBookName(b.NameEN)] = b.Code
	}
	extra := map[string]string{
		// alternate full names
		"psalm": "PSA", "canticle of canticles": "SNG", "song of solomon": "SNG",
		"qoheleth": "ECC", "ecclesiasticus": "SIR", "apocalypse": "REV",
		"acts of the apostles": "ACT",
		// USCCB abbreviations
		"gn": "GEN", "ex": "EXO", "lv": "LEV", "nm": "NUM", "dt": "DEU",
		"jos": "JOS", "jgs": "JDG", "ru": "RUT",
		"1 sm": "1SA", "2 sm": "2SA", "1 kgs": "1KI", "2 kgs": "2KI",
		"1 chr": "1CH", "2 chr": "2CH", "ezr": "EZR", "neh": "NEH",
		"tb": "TOB", "jdt": "JDT", "est": "EST", "1 mc": "1MA", "2 mc": "2MA",
		"jb": "JOB", "ps": "PSA", "pss": "PSA", "prv": "PRO", "eccl": "ECC",
		"sg": "SNG", "wis": "WIS", "sir": "SIR",
		"is": "ISA", "jer": "JER", "lam": "LAM", "bar": "BAR",
		"ez": "EZK", "ezek": "EZK", "dn": "DAN", "hos": "HOS", "jl": "JOL",
		"am": "AMO", "ob": "OBA", "jon": "JON", "mi": "MIC",
		"na": "NAM", "nah": "NAM", "hb": "HAB", "zep": "ZEP", "hg": "HAG",
		"zec": "ZEC", "mal": "MAL",
		"mt": "MAT", "mk": "MRK", "lk": "LUK", "jn": "JHN", "acts": "ACT",
		"rom": "ROM", "1 cor": "1CO", "2 cor": "2CO", "gal": "GAL",
		"eph": "EPH", "phil": "PHP", "col": "COL",
		"1 thes": "1TH", "2 thes": "2TH", "1 tm": "1TI", "2 tm": "2TI",
		"ti": "TIT", "phlm": "PHM", "heb": "HEB", "jas": "JAS",
		"1 pt": "1PE", "2 pt": "2PE", "1 jn": "1JN", "2 jn": "2JN", "3 jn": "3JN",
		"jude": "JUD", "rv": "REV",
	}
	for k, v := range extra {
		m[k] = v
	}
	return m
}()

// bookCodeBySlug maps alnum-normalized canonical slugs ("1corinthians") to
// codes, for resolving books from USCCB link hrefs.
var bookCodeBySlug = func() map[string]string {
	m := map[string]string{}
	for _, b := range canon.Books {
		m[normalizeSlug(b.Slug)] = b.Code
	}
	return m
}()

// bookAliasesES maps normalized Spanish book names (canon NameES plus
// common variants) to USFM codes. Vatican News prints full Spanish names.
var bookAliasesES = func() map[string]string {
	m := map[string]string{}
	for _, b := range canon.Books {
		m[normalizeBookName(b.NameES)] = b.Code
	}
	extra := map[string]string{
		// alternate full names
		"salmo": "PSA", "hechos": "ACT", "cantares": "SNG",
		"siracide": "SIR", "sirac": "SIR", "qohelet": "ECC",
		// Spanish abbreviations (some pages abbreviate, e.g. "Hb 4,1-16")
		"gn": "GEN", "ex": "EXO", "lv": "LEV", "nm": "NUM", "dt": "DEU",
		"jos": "JOS", "jue": "JDG", "jc": "JDG", "rt": "RUT",
		"1 sam": "1SA", "2 sam": "2SA", "1 sm": "1SA", "2 sm": "2SA",
		"1 re": "1KI", "2 re": "2KI", "1 r": "1KI", "2 r": "2KI",
		"1 cro": "1CH", "2 cro": "2CH", "1 cron": "1CH", "2 cron": "2CH",
		"1 par": "1CH", "2 par": "2CH", "esd": "EZR", "neh": "NEH",
		"tob": "TOB", "tb": "TOB", "jdt": "JDT", "est": "EST",
		"1 mac": "1MA", "2 mac": "2MA", "1 m": "1MA", "2 m": "2MA",
		"jb": "JOB", "sal": "PSA", "prov": "PRO", "pr": "PRO",
		"ecl": "ECC", "qo": "ECC", "cant": "SNG", "ct": "SNG",
		"sab": "WIS", "sb": "WIS", "eclo": "SIR", "sir": "SIR",
		"is": "ISA", "jer": "JER", "jr": "JER", "lam": "LAM", "bar": "BAR",
		"ez": "EZK", "dan": "DAN", "dn": "DAN", "os": "HOS", "jl": "JOL",
		"am": "AMO", "abd": "OBA", "ab": "OBA", "jon": "JON",
		"miq": "MIC", "mi": "MIC", "nah": "NAM", "na": "NAM", "hab": "HAB",
		"sof": "ZEP", "so": "ZEP", "ag": "HAG", "zac": "ZEC", "za": "ZEC",
		"mal": "MAL",
		"mt":  "MAT", "mc": "MRK", "lc": "LUK", "jn": "JHN", "hch": "ACT",
		"rom": "ROM", "rm": "ROM", "1 cor": "1CO", "2 cor": "2CO",
		"1 co": "1CO", "2 co": "2CO", "gal": "GAL", "ga": "GAL",
		"ef": "EPH", "flp": "PHP", "fil": "PHP", "col": "COL",
		"1 tes": "1TH", "2 tes": "2TH", "1 ts": "1TH", "2 ts": "2TH",
		"1 tim": "1TI", "2 tim": "2TI", "1 tm": "1TI", "2 tm": "2TI",
		"tit": "TIT", "tt": "TIT", "flm": "PHM", "heb": "HEB", "hb": "HEB",
		"sant": "JAS", "st": "JAS", "1 pe": "1PE", "2 pe": "2PE",
		"1 p": "1PE", "2 p": "2PE", "1 jn": "1JN", "2 jn": "2JN",
		"3 jn": "3JN", "jds": "JUD", "ap": "REV",
	}
	for k, v := range extra {
		m[k] = v
	}
	return m
}()

// accentFolder normalizes the accented vowels found in Spanish book names.
// Vatican News occasionally uses Greek lookalikes ("Sabidurίa" carries an
// iota with tonos), so those fold to plain Latin too.
var accentFolder = strings.NewReplacer(
	"á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u", "ü", "u", "ñ", "n",
	"ά", "a", "έ", "e", "ί", "i", "ό", "o", "ύ", "u", "ι", "i", "ϊ", "i",
)

func normalizeBookName(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, ".", "")
	s = accentFolder.Replace(s)
	return strings.Join(strings.Fields(s), " ")
}

func normalizeSlug(s string) string {
	var out []rune
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			out = append(out, r)
		}
	}
	return string(out)
}

// verseLetterSuffix strips lectionary sub-verse letters: "10a" → "10".
var verseLetterSuffix = regexp.MustCompile(`(\d+)[a-z]+`)

// verseAndSeparator: psalm citations join verses with "and"
// ("Psalm 33:12-13, 20 and 22"); it separates exactly like a comma.
var verseAndSeparator = regexp.MustCompile(`\band\b`)

// citationPrefix drops the non-citation lead-ins USCCB prints.
var citationPrefix = regexp.MustCompile(`^(?i)(cf\.?|see)\s+`)

var romanOrdinal = map[string]string{"i": "1", "ii": "2", "iii": "3"}

// splitBookAndCitation cuts "1 Corinthians 12:4-11" into the book part and
// the citation part. Book = optional ordinal + alpha words up to the first
// token starting with a digit or containing ':'.
func splitBookAndCitation(raw string) (book, citation string) {
	tokens := strings.Fields(raw)
	idx := 0
	if idx < len(tokens) {
		low := strings.ToLower(strings.TrimRight(tokens[idx], "."))
		if arabic, ok := romanOrdinal[low]; ok {
			tokens[idx] = arabic
			idx++
		} else if low == "1" || low == "2" || low == "3" {
			idx++
		}
	}
	for idx < len(tokens) {
		t := tokens[idx]
		if strings.ContainsAny(t, ":") || (t != "" && t[0] >= '0' && t[0] <= '9') {
			break
		}
		idx++
	}
	return strings.Join(tokens[:idx], " "), strings.Join(tokens[idx:], " ")
}

// ExpandReference resolves a printed citation ("Wisdom 12:13, 16-19") into
// per-verse universal IDs ("WIS.12.13", "WIS.12.16", …). hrefSlug is the
// book slug from the source link, used as fallback book resolution; lengths
// may be nil, in which case cross-chapter ranges fail with an error.
func ExpandReference(raw, hrefSlug string, lengths ChapterLengths) ([]string, error) {
	cleaned := citationPrefix.ReplaceAllString(strings.TrimSpace(raw), "")
	book, citation := splitBookAndCitation(cleaned)

	code, ok := bookAliases[normalizeBookName(book)]
	if !ok {
		code, ok = bookCodeBySlug[normalizeSlug(hrefSlug)]
	}
	if !ok {
		return nil, fmt.Errorf("unknown book %q in %q", book, raw)
	}
	if citation == "" {
		return nil, fmt.Errorf("no chapter/verse part in %q", raw)
	}
	return expandCitation(code, citation, lengths)
}

// esChapterComma finds the "chapter, " that opens each chapter group in a
// Spanish citation (at the start, after ';', or after a range dash).
var esChapterComma = regexp.MustCompile(`(^|[;–—-])\s*(\d+)\s*,\s*`)

// convertESCitation rewrites a Spanish citation into the colon/comma form
// expandCitation understands: chapters are set off with a comma and verse
// groups with a period ("12, 13. 16-19" ≡ "12:13, 16-19").
func convertESCitation(citation string) string {
	citation = esChapterComma.ReplaceAllString(citation, "$1$2:")
	return strings.ReplaceAll(citation, ".", ",")
}

// ExpandReferenceES resolves a Spanish citation as printed by Vatican News
// ("Sabiduría 12, 13. 16-19") into per-verse universal IDs.
func ExpandReferenceES(raw string, lengths ChapterLengths) ([]string, error) {
	cleaned := citationPrefix.ReplaceAllString(strings.TrimSpace(raw), "")
	book, citation := splitBookAndCitation(cleaned)

	code, ok := bookAliasesES[normalizeBookName(book)]
	if !ok {
		return nil, fmt.Errorf("unknown book %q in %q", book, raw)
	}
	if citation == "" {
		return nil, fmt.Errorf("no chapter/verse part in %q", raw)
	}
	return expandCitation(code, convertESCitation(citation), lengths)
}

// expandCitation walks the chapter/verse part of a citation. Grammar per
// comma/semicolon-separated segment (current chapter is carried along):
//
//	"12:13"      verse 13 of chapter 12
//	"16-19"      verse range in the current chapter
//	"9:1-8"      verse range in a new chapter
//	"1:1—2:2"    cross-chapter range (needs lengths)
//	"9—25:17"    cross-chapter starting in the current chapter
func expandCitation(code, citation string, lengths ChapterLengths) ([]string, error) {
	citation = verseLetterSuffix.ReplaceAllString(citation, "$1")
	citation = verseAndSeparator.ReplaceAllString(citation, ",")
	// Unify dash variants; cross-chapter is detected by ':' on the right side.
	for _, dash := range []string{"—", "–", "--"} {
		citation = strings.ReplaceAll(citation, dash, "-")
	}

	var ids []string
	chapter := 0
	if singleChapterBooks[code] && !strings.Contains(citation, ":") {
		chapter = 1
	}

	for _, segment := range strings.FieldsFunc(citation, func(r rune) bool { return r == ',' || r == ';' }) {
		segment = strings.TrimSpace(segment)
		if segment == "" {
			continue
		}
		from, to, isRange := segment, segment, false
		if i := strings.Index(segment, "-"); i >= 0 {
			from, to, isRange = segment[:i], segment[i+1:], true
		}

		fromCh, fromV, err := parseChapterVerse(from, chapter)
		if err != nil {
			return nil, fmt.Errorf("%q: %w", segment, err)
		}
		toCh, toV := fromCh, fromV
		if isRange {
			if toCh, toV, err = parseChapterVerse(to, fromCh); err != nil {
				return nil, fmt.Errorf("%q: %w", segment, err)
			}
		}
		chapter = toCh

		span, err := expandSpan(code, fromCh, fromV, toCh, toV, lengths)
		if err != nil {
			return nil, err
		}
		ids = append(ids, span...)
	}
	if len(ids) == 0 {
		return nil, fmt.Errorf("empty citation %q", citation)
	}
	return ids, nil
}

// parseChapterVerse parses "12:13" or a bare verse "13" against the current
// chapter. A bare number with no current chapter is a chapter-only citation,
// which cannot be expanded to verses.
func parseChapterVerse(s string, currentChapter int) (int, int, error) {
	s = strings.TrimSpace(s)
	if ch, rest, found := strings.Cut(s, ":"); found {
		c, err1 := strconv.Atoi(strings.TrimSpace(ch))
		v, err2 := strconv.Atoi(strings.TrimSpace(rest))
		if err1 != nil || err2 != nil {
			return 0, 0, fmt.Errorf("unparseable chapter:verse %q", s)
		}
		return c, v, nil
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return 0, 0, fmt.Errorf("unparseable verse %q", s)
	}
	if currentChapter == 0 {
		return 0, 0, fmt.Errorf("chapter-only citation %q", s)
	}
	return currentChapter, v, nil
}

// expandSpan emits every verse ID between (fromCh, fromV) and (toCh, toV)
// inclusive. Spans across chapters need the chapter lengths table.
func expandSpan(code string, fromCh, fromV, toCh, toV int, lengths ChapterLengths) ([]string, error) {
	if toCh < fromCh || (toCh == fromCh && toV < fromV) {
		return nil, fmt.Errorf("%s: descending span %d:%d-%d:%d", code, fromCh, fromV, toCh, toV)
	}

	var ids []string
	for ch := fromCh; ch <= toCh; ch++ {
		first, last := 1, 0
		if ch == fromCh {
			first = fromV
		}
		if ch == toCh {
			last = toV
		} else {
			bookLengths, ok := lengths[code]
			if !ok {
				return nil, fmt.Errorf("%s %d:%d-%d:%d spans chapters but no chapter lengths are available (pass --bible)", code, fromCh, fromV, toCh, toV)
			}
			if last, ok = bookLengths[ch]; !ok {
				return nil, fmt.Errorf("%s: no length for chapter %d", code, ch)
			}
		}
		if last-first > 300 {
			return nil, fmt.Errorf("%s %d:%d-%d — implausibly long span", code, ch, first, last)
		}
		for v := first; v <= last; v++ {
			ids = append(ids, fmt.Sprintf("%s.%d.%d", code, ch, v))
		}
	}
	return ids, nil
}
