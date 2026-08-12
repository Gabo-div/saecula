// Package catechism serves the Catechism of the Catholic Church: numbered
// paragraphs and their text, read straight from the translation store
// (entity IDs "CCC.<number>"). No graph is needed for reading.
package catechism

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"saecula/back/internal/httpx"
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
	pool *pgxpool.Pool
}

func NewAPI(pool *pgxpool.Pool) *API {
	return &API{pool: pool}
}

func (a *API) Pattern() string { return "/catechism" }

func (a *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", a.List)
	r.Get("/{number}", a.One)
	return r
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
	rows, err := a.pool.Query(r.Context(),
		`SELECT CAST(split_part(entity_id, '.', 2) AS INT) AS num, raw_content
		 FROM text_documents
		 WHERE entity_id LIKE 'CCC.%' AND language_code = $1
		   AND CAST(split_part(entity_id, '.', 2) AS INT) BETWEEN $2 AND $3
		 ORDER BY num
		 LIMIT $4`,
		lang, from, to, limit+1)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "catechism query failed")
		return
	}
	defer rows.Close()

	paragraphs := make([]Paragraph, 0, limit)
	for rows.Next() {
		var p Paragraph
		if err := rows.Scan(&p.Number, &p.Text); err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "catechism scan failed")
			return
		}
		paragraphs = append(paragraphs, p)
	}
	if err := rows.Err(); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "catechism read failed")
		return
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

	var p Paragraph
	err = a.pool.QueryRow(r.Context(),
		`SELECT CAST(split_part(entity_id, '.', 2) AS INT), raw_content
		 FROM text_documents
		 WHERE entity_id = $1 AND language_code = $2`,
		"CCC."+strconv.Itoa(number), lang).Scan(&p.Number, &p.Text)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "paragraph not found")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
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
