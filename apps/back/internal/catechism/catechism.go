// Package catechism serves the Catechism of the Catholic Church: numbered
// paragraphs and their text, read straight from the translation store
// (entity IDs "CCC.<number>"). No graph is needed for reading.
package catechism

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"saecula/back/internal/httpx"
	"saecula/db/gen"
)

const defaultLimit = 50

// Paragraph is one numbered CCC paragraph.
type Paragraph struct {
	Number int    `json:"number"`
	Text   string `json:"text"`
}

// API serves the Catechism. Text is currently English-only (translation
// ccc_scborromeo_en); lang defaults to "en".
type API struct {
	q *gen.Queries
}

func NewAPI(pool *pgxpool.Pool) *API {
	return &API{q: gen.New(pool)}
}

func (a *API) Pattern() string { return "/catechism" }

func (a *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", a.List)
	r.Get("/search", a.Search)
	r.Get("/{number}", a.One)
	return r
}

type searchResult struct {
	Number  int    `json:"number"`
	Snippet string `json:"snippet"`
}

// GET /api/catechism/search?q=&lang=&limit=
func (a *API) Search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	lang := langParam(r)
	limit := queryInt(r, "limit", 20)
	if limit < 1 || limit > 50 {
		limit = 20
	}

	results := []searchResult{}
	seen := map[int]bool{}

	// A bare number jumps straight to that paragraph (the Catechism is cited by
	// number), which a text search on the digits would never find.
	if n, convErr := strconv.Atoi(q); convErr == nil && n >= 1 {
		text, err := a.q.CatechismOne(r.Context(), gen.CatechismOneParams{
			EntityID:     "CCC." + strconv.Itoa(n),
			LanguageCode: lang,
		})
		if err == nil {
			runes := []rune(text)
			if len(runes) > 140 {
				text = string(runes[:140]) + "…"
			}
			results = append(results, searchResult{Number: n, Snippet: text})
			seen[n] = true
		}
	}

	if len([]rune(q)) >= 2 {
		rows, err := a.q.CatechismSearch(r.Context(), gen.CatechismSearchParams{
			Query: q,
			Lang:  lang,
			Lim:   int32(limit),
		})
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "catechism search failed")
			return
		}
		for _, row := range rows {
			res := searchResult{Number: int(row.Num), Snippet: row.Snippet}
			if seen[res.Number] {
				continue
			}
			results = append(results, res)
		}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"query": q, "lang": lang, "results": results})
}

type listResponse struct {
	Lang       string      `json:"lang"`
	From       int         `json:"from"`
	HasMore    bool        `json:"has_more"`
	Paragraphs []Paragraph `json:"paragraphs"`
}

// GET /api/catechism?lang=&from=1&to=1065&limit=50
// `to` (optional, 0 = no bound) caps the paragraph number so a request can be
// scoped to one part of the Catechism.
func (a *API) List(w http.ResponseWriter, r *http.Request) {
	lang := langParam(r)
	from := queryInt(r, "from", 1)
	to := queryInt(r, "to", 0)
	limit := queryInt(r, "limit", defaultLimit)
	if limit < 1 || limit > 200 {
		limit = defaultLimit
	}
	if to <= 0 {
		to = 1 << 30 // effectively unbounded
	}

	// Fetch one extra row to tell whether more paragraphs follow.
	rows, err := a.q.CatechismRange(r.Context(), gen.CatechismRangeParams{
		Lang:    lang,
		FromNum: int32(from),
		ToNum:   int32(to),
		Lim:     int32(limit + 1),
	})
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "catechism query failed")
		return
	}

	paragraphs := make([]Paragraph, 0, limit)
	for _, row := range rows {
		paragraphs = append(paragraphs, Paragraph{Number: int(row.Num), Text: row.RawContent})
	}

	hasMore := len(paragraphs) > limit
	if hasMore {
		paragraphs = paragraphs[:limit]
	}
	httpx.WriteJSON(w, http.StatusOK, listResponse{
		Lang: lang, From: from, HasMore: hasMore, Paragraphs: paragraphs,
	})
}

// GET /api/catechism/{number}?lang=
func (a *API) One(w http.ResponseWriter, r *http.Request) {
	number, err := strconv.Atoi(chi.URLParam(r, "number"))
	if err != nil || number < 1 {
		httpx.WriteError(w, http.StatusBadRequest, "number must be a positive integer")
		return
	}
	lang := langParam(r)

	row, err := a.q.CatechismByEntity(r.Context(), gen.CatechismByEntityParams{
		EntityID:     "CCC." + strconv.Itoa(number),
		LanguageCode: lang,
	})
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "paragraph not found")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, Paragraph{Number: int(row.Num), Text: row.RawContent})
}

func langParam(r *http.Request) string {
	if lang := r.URL.Query().Get("lang"); lang != "" {
		return lang
	}
	return "en"
}

func queryInt(r *http.Request, key string, def int) int {
	if v := r.URL.Query().Get(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
