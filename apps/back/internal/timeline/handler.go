package timeline

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"saecula/back/internal/httpx"
)

// API serves the hybrid timeline endpoint. Both stores are injected as
// interfaces: node structure and temporal placement come from a
// GraphRepository, text payloads from a TextRepository.
type API struct {
	graph GraphRepository
	texts TextRepository
}

func NewAPI(graph GraphRepository, texts TextRepository) *API {
	return &API{graph: graph, texts: texts}
}

// Pattern is where the server mounts this API (under the protected group).
func (a *API) Pattern() string { return "/timeline" }

// Routes exposes the timeline endpoints.
func (a *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", a.Get)
	return r
}

type response struct {
	StartYear int64  `json:"start_year"`
	EndYear   int64  `json:"end_year"`
	Lang      string `json:"lang"`
	Count     int    `json:"count"`
	Nodes     []Node `json:"nodes"`
}

// Get handles GET /api/timeline?start_year=&end_year=&lang=&translation=
func (a *API) Get(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	startYear, err := strconv.ParseInt(q.Get("start_year"), 10, 64)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "start_year must be an integer (negative = BC)")
		return
	}
	endYear, err := strconv.ParseInt(q.Get("end_year"), 10, 64)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "end_year must be an integer")
		return
	}
	if startYear > endYear {
		httpx.WriteError(w, http.StatusBadRequest, "start_year must be <= end_year")
		return
	}
	lang := q.Get("lang")
	if lang == "" {
		lang = "en"
	}
	translation := q.Get("translation") // optional: pin a specific edition

	nodes, err := a.graph.NodesInRange(r.Context(), startYear, endYear)
	if err != nil {
		slog.Error("timeline: graph query", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "graph query failed")
		return
	}

	ids := make([]string, len(nodes))
	for i, n := range nodes {
		ids[i] = n.ID
	}
	texts, err := a.texts.TextsFor(r.Context(), ids, lang, translation)
	if err != nil {
		slog.Error("timeline: text lookup", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "text lookup failed")
		return
	}
	for i := range nodes {
		if text, ok := texts[nodes[i].ID]; ok {
			nodes[i].Text = text
		}
	}

	httpx.WriteJSON(w, http.StatusOK, response{
		StartYear: startYear,
		EndYear:   endYear,
		Lang:      lang,
		Count:     len(nodes),
		Nodes:     nodes,
	})
}
