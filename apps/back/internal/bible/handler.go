package bible

import (
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"saecula/back/internal/httpx"
	"saecula/canon"
)

// API serves the Bible reading endpoints: book catalog, chapter text,
// available translations and the verse of the day.
type API struct {
	graph GraphRepository
	texts TextRepository
	now   func() time.Time // injected clock so the daily verse is testable
}

func NewAPI(graph GraphRepository, texts TextRepository) *API {
	return &API{graph: graph, texts: texts, now: time.Now}
}

// Pattern is where the server mounts this API (under the protected group).
func (a *API) Pattern() string { return "/bible" }

// Routes exposes the Bible endpoints.
func (a *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/books", a.Books)
	r.Get("/translations", a.Translations)
	r.Get("/daily", a.Daily)
	r.Get("/search", a.Search)
	r.Get("/{book}/{chapter}", a.Chapter)
	return r
}

// ---------------------------------------------------------------------------
// GET /api/bible/books?lang=
// ---------------------------------------------------------------------------

type bookResponse struct {
	Code      string `json:"code"`
	Slug      string `json:"slug"`
	Name      string `json:"name"`
	Testament string `json:"testament"`
	Chapters  int64  `json:"chapters"`
	StartYear int64  `json:"start_year"`
	EndYear   int64  `json:"end_year"`
	Era       string `json:"era"`
}

// Books merges the canonical catalog (order, slugs, localized names) with
// the chapter counts present in the seeded graph. Books with no seeded
// verses are omitted — the reader can only open what exists.
func (a *API) Books(w http.ResponseWriter, r *http.Request) {
	lang := langParam(r)
	translation := r.URL.Query().Get("translation")

	counts, err := a.graph.ChapterCounts(r.Context())
	if err != nil {
		slog.Error("bible: chapter counts", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "graph query failed")
		return
	}

	// Source book titles for the selected edition; falls back to the catalog
	// per book when a source has no stored title.
	names, err := a.texts.BookNames(r.Context(), lang, translation)
	if err != nil {
		slog.Warn("bible: book names lookup failed, using catalog", "error", err)
		names = nil
	}

	books := make([]bookResponse, 0, len(counts))
	for _, b := range canon.Books {
		chapters, ok := counts[b.Code]
		if !ok {
			continue
		}
		books = append(books, bookResponse{
			Code:      b.Code,
			Slug:      b.Slug,
			Name:      bookNameOr(names[b.Code], b, lang),
			Testament: b.Testament,
			Chapters:  chapters,
			StartYear: b.StartYear,
			EndYear:   b.EndYear,
			Era:       b.Era,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"count": len(books), "books": books})
}

// ---------------------------------------------------------------------------
// GET /api/bible/translations
// ---------------------------------------------------------------------------

func (a *API) Translations(w http.ResponseWriter, r *http.Request) {
	translations, err := a.texts.Translations(r.Context())
	if err != nil {
		slog.Error("bible: translations", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "translation lookup failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"translations": translations})
}

// ---------------------------------------------------------------------------
// GET /api/bible/{book}/{chapter}?lang=&translation=
// ---------------------------------------------------------------------------

type chapterResponse struct {
	BookCode string  `json:"book_code"`
	BookSlug string  `json:"book_slug"`
	BookName string  `json:"book_name"`
	Chapter  int     `json:"chapter"`
	Lang     string  `json:"lang"`
	Verses   []Verse `json:"verses"`
}

// Chapter accepts the book as either a USFM code (JHN) or a canonical
// English slug (john).
func (a *API) Chapter(w http.ResponseWriter, r *http.Request) {
	book, ok := canon.ByCode(chi.URLParam(r, "book"))
	if !ok {
		book, ok = canon.BySlug(chi.URLParam(r, "book"))
	}
	if !ok {
		httpx.WriteError(w, http.StatusNotFound, "unknown book — use a USFM code (JHN) or canonical slug (john)")
		return
	}
	chapter, err := strconv.Atoi(chi.URLParam(r, "chapter"))
	if err != nil || chapter < 1 {
		httpx.WriteError(w, http.StatusBadRequest, "chapter must be a positive integer")
		return
	}
	lang := langParam(r)
	translation := r.URL.Query().Get("translation")

	verses, err := a.texts.ChapterVerses(r.Context(), book.Code, chapter, lang, translation)
	if err != nil {
		slog.Error("bible: chapter verses", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "text lookup failed")
		return
	}
	if len(verses) == 0 {
		httpx.WriteError(w, http.StatusNotFound, fmt.Sprintf("no text for %s %d in %q", book.Code, chapter, lang))
		return
	}

	// The book title as the selected edition names it, catalog fallback.
	bookTitle := bookName(*book, lang)
	if bt, err := a.texts.VerseText(r.Context(), "BIBLE."+book.Code, lang, translation); err == nil && bt != nil && bt.Text != "" {
		bookTitle = bt.Text
	}

	httpx.WriteJSON(w, http.StatusOK, chapterResponse{
		BookCode: book.Code,
		BookSlug: book.Slug,
		BookName: bookTitle,
		Chapter:  chapter,
		Lang:     lang,
		Verses:   verses,
	})
}

// ---------------------------------------------------------------------------
// GET /api/bible/daily?lang=&translation=
// ---------------------------------------------------------------------------

// dailyVerses is a curated rotation of well-known verses; the day of the
// year picks deterministically, so every client sees the same verse on the
// same date without any stored state.
var dailyVerses = []string{
	"REV.12.1",
}

type dailyResponse struct {
	Date                string               `json:"date"`
	BookCode            string               `json:"book_code"`
	BookName            string               `json:"book_name"`
	Chapter             int                  `json:"chapter"`
	Reference           string               `json:"reference"`
	ImageURL            string               `json:"image_url,omitempty"`
	Attribution         string               `json:"attribution,omitempty"`
	Verses              []Verse              `json:"verses"`
	CatechismNumbers    []int                `json:"catechism_numbers"`
	CatechismParagraphs []CatechismParagraph `json:"catechism_paragraphs"`
}

func (a *API) Daily(w http.ResponseWriter, r *http.Request) {
	lang := langParam(r)
	today := a.now().UTC()
	date := today.Format("2006-01-02")

	// The client may pin "today" to its own local date (?date=YYYY-MM-DD),
	// so the verse/catechism roll over at the user's midnight, not UTC's.
	if dp := r.URL.Query().Get("date"); dp != "" {
		parsed, err := time.Parse("2006-01-02", dp)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "date must be YYYY-MM-DD")
			return
		}
		today = parsed
		date = dp
	}

	// A curated feature (admin/CLI seeded) wins; otherwise fall back to the
	// deterministic built-in rotation. A lookup error is not fatal — degrade
	// to the fallback rather than 500 the home screen.
	var verseIDs []string
	var imageURL string
	var attribution string
	var catechismNums []int
	if f, err := a.texts.DailyFeature(r.Context(), date); err != nil {
		slog.Warn("bible: daily feature lookup failed, using fallback", "error", err)
	} else if f != nil && len(f.VerseIDs) > 0 {
		verseIDs = f.VerseIDs
		imageURL = f.ImageURL
		attribution = f.Attribution
		catechismNums = f.CatechismNumbers
	}
	if len(verseIDs) == 0 {
		verseIDs = []string{dailyVerses[today.YearDay()%len(dailyVerses)]}
	}

	bookCode, chapter, vFirst, ok := splitEntity(verseIDs[0])
	if !ok {
		slog.Error("bible: daily verse has malformed entity id", "entity_id", verseIDs[0])
		httpx.WriteError(w, http.StatusInternalServerError, "daily verse misconfigured")
		return
	}
	book, ok := canon.ByCode(bookCode)
	if !ok {
		slog.Error("bible: daily verse references unknown book", "entity_id", verseIDs[0])
		httpx.WriteError(w, http.StatusInternalServerError, "daily verse misconfigured")
		return
	}

	translation := r.URL.Query().Get("translation")
	verses := make([]Verse, 0, len(verseIDs))
	for _, id := range verseIDs {
		text, err := a.texts.VerseText(r.Context(), id, lang, translation)
		if err != nil {
			slog.Error("bible: daily verse text", "error", err)
			httpx.WriteError(w, http.StatusInternalServerError, "text lookup failed")
			return
		}
		if text != nil {
			verses = append(verses, *text)
		}
	}

	name := bookName(*book, lang)
	_, _, vLast, _ := splitEntity(verseIDs[len(verseIDs)-1])
	reference := fmt.Sprintf("%s %d,%d", name, chapter, vFirst)
	if vLast != vFirst {
		reference = fmt.Sprintf("%s %d,%d-%d", name, chapter, vFirst, vLast)
	}

	// The daily Catechism paragraph(s), when the feature lists any. A lookup
	// error degrades to an empty list rather than failing the whole request.
	catechismParagraphs, err := a.texts.CatechismParagraphs(r.Context(), catechismNums, lang)
	if err != nil {
		slog.Warn("bible: daily catechism lookup failed", "error", err)
		catechismParagraphs = nil
	}

	httpx.WriteJSON(w, http.StatusOK, dailyResponse{
		Date:                date,
		BookCode:            book.Code,
		BookName:            name,
		Chapter:             chapter,
		Reference:           reference,
		ImageURL:            imageURL,
		Attribution:         attribution,
		Verses:              verses,
		CatechismNumbers:    catechismNums,
		CatechismParagraphs: catechismParagraphs,
	})
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func langParam(r *http.Request) string {
	if lang := r.URL.Query().Get("lang"); lang != "" {
		return lang
	}
	return "en"
}

func bookName(b canon.Book, lang string) string {
	if lang == "es" {
		return b.NameES
	}
	return b.NameEN
}

// bookNameOr prefers the source title, falling back to the catalog name.
func bookNameOr(sourceName string, b canon.Book, lang string) string {
	if sourceName != "" {
		return sourceName
	}
	return bookName(b, lang)
}

type searchResult struct {
	BookCode  string `json:"book_code"`
	BookName  string `json:"book_name"`
	Chapter   int    `json:"chapter"`
	Verse     int    `json:"verse"`
	Reference string `json:"reference"`
	Text      string `json:"text"`
}

// GET /api/bible/search?q=&translation=&lang=&limit=
func (a *API) Search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	lang := langParam(r)
	limit := 20
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 && n <= 50 {
		limit = n
	}

	results := []searchResult{}
	if len([]rune(q)) >= 2 {
		hits, err := a.texts.SearchVerses(r.Context(), q, r.URL.Query().Get("translation"), limit)
		if err != nil {
			slog.Error("bible: search", "error", err)
			httpx.WriteError(w, http.StatusInternalServerError, "search failed")
			return
		}
		for _, h := range hits {
			code, chapter, verse, ok := splitEntity(h.EntityID)
			if !ok {
				continue
			}
			name := code
			if b, ok := canon.ByCode(code); ok {
				name = bookName(*b, lang)
			}
			results = append(results, searchResult{
				BookCode:  code,
				BookName:  name,
				Chapter:   chapter,
				Verse:     verse,
				Reference: fmt.Sprintf("%s %d,%d", name, chapter, verse),
				Text:      h.Text,
			})
		}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"query": q, "results": results})
}

// splitEntity decomposes a BOOK.CHAPTER.VERSE entity ID.
func splitEntity(entityID string) (book string, chapter, verse int, ok bool) {
	parts := strings.Split(entityID, ".")
	if len(parts) != 3 {
		return "", 0, 0, false
	}
	chapter, errChapter := strconv.Atoi(parts[1])
	verse, errVerse := strconv.Atoi(parts[2])
	if errChapter != nil || errVerse != nil {
		return "", 0, 0, false
	}
	return parts[0], chapter, verse, true
}
