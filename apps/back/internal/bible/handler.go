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

	counts, err := a.graph.ChapterCounts(r.Context())
	if err != nil {
		slog.Error("bible: chapter counts", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "graph query failed")
		return
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
			Name:      bookName(b, lang),
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

	verses, err := a.texts.ChapterVerses(r.Context(), book.Code, chapter, lang, r.URL.Query().Get("translation"))
	if err != nil {
		slog.Error("bible: chapter verses", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "text lookup failed")
		return
	}
	if len(verses) == 0 {
		httpx.WriteError(w, http.StatusNotFound, fmt.Sprintf("no text for %s %d in %q", book.Code, chapter, lang))
		return
	}

	httpx.WriteJSON(w, http.StatusOK, chapterResponse{
		BookCode: book.Code,
		BookSlug: book.Slug,
		BookName: bookName(*book, lang),
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
	"1MA.3.19",
}

type dailyResponse struct {
	EntityID  string `json:"entity_id"`
	BookCode  string `json:"book_code"`
	BookName  string `json:"book_name"`
	Chapter   int    `json:"chapter"`
	Verse     int    `json:"verse"`
	Reference string `json:"reference"`
	Date      string `json:"date"`
	Text      *Verse `json:"text,omitempty"`
}

func (a *API) Daily(w http.ResponseWriter, r *http.Request) {
	lang := langParam(r)
	today := a.now().UTC()
	entityID := dailyVerses[today.YearDay()%len(dailyVerses)]

	bookCode, chapter, verse, ok := splitEntity(entityID)
	if !ok {
		slog.Error("bible: daily verse has malformed entity id", "entity_id", entityID)
		httpx.WriteError(w, http.StatusInternalServerError, "daily verse misconfigured")
		return
	}

	book, ok := canon.ByCode(bookCode)
	if !ok {
		slog.Error("bible: daily verse references unknown book", "entity_id", entityID)
		httpx.WriteError(w, http.StatusInternalServerError, "daily verse misconfigured")
		return
	}

	text, err := a.texts.VerseText(r.Context(), entityID, lang, r.URL.Query().Get("translation"))
	if err != nil {
		slog.Error("bible: daily verse text", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "text lookup failed")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, dailyResponse{
		EntityID:  entityID,
		BookCode:  book.Code,
		BookName:  bookName(*book, lang),
		Chapter:   chapter,
		Verse:     verse,
		Reference: fmt.Sprintf("%s %d,%d", bookName(*book, lang), chapter, verse),
		Date:      today.Format("2006-01-02"),
		Text:      text,
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
