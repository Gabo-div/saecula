package bookmarks

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"saecula/back/internal/auth"
	"saecula/back/internal/httpx"
)

// API serves the user bookmarks / saved-verses endpoints.
type API struct {
	repo Repository
}

func NewAPI(repo Repository) *API {
	return &API{repo: repo}
}

func (a *API) Pattern() string { return "/bookmarks" }

func (a *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", a.List)
	r.Post("/", a.Upsert)
	r.Route("/by-id", func(r chi.Router) {
		r.Delete("/{id}", a.DeleteByID)
	})
	r.Route("/{entityID}", func(r chi.Router) {
		r.Get("/", a.Get)
		r.Delete("/", a.Delete)
		r.Put("/highlight", a.SetHighlight)
		r.Put("/note", a.SetNote)
	})
	return r
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func userID(r *http.Request) (string, bool) {
	return auth.UserIDFromContext(r.Context())
}

// ---------------------------------------------------------------------------
// GET /api/bookmarks?filter=highlighted|notes
// ---------------------------------------------------------------------------

func (a *API) List(w http.ResponseWriter, r *http.Request) {
	uid, ok := userID(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	filter := r.URL.Query().Get("filter")

	verses, err := a.repo.List(r.Context(), uid, filter)
	if err != nil {
		slog.Error("bookmarks: list", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "failed to load saved verses")
		return
	}
	if verses == nil {
		verses = []SavedVerse{}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"count":  len(verses),
		"verses": verses,
	})
}

// ---------------------------------------------------------------------------
// GET /api/bookmarks/{entityID}
// ---------------------------------------------------------------------------

func (a *API) Get(w http.ResponseWriter, r *http.Request) {
	uid, ok := userID(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	entityID := chi.URLParam(r, "entityID")

	v, err := a.repo.Get(r.Context(), uid, entityID)
	if err != nil {
		slog.Error("bookmarks: get", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "lookup failed")
		return
	}
	if v == nil {
		httpx.WriteError(w, http.StatusNotFound, "verse not saved")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, v)
}

// ---------------------------------------------------------------------------
// POST /api/bookmarks  { entity_id, reference, verse_text, highlight_color?, note? }
// ---------------------------------------------------------------------------

type upsertRequest struct {
	EntityID       string  `json:"entity_id"`
	Reference      string  `json:"reference"`
	VerseText      string  `json:"verse_text"`
	HighlightColor *string `json:"highlight_color,omitempty"`
	Note           *string `json:"note,omitempty"`
}

func (a *API) Upsert(w http.ResponseWriter, r *http.Request) {
	uid, ok := userID(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}

	var req upsertRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.EntityID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "entity_id is required")
		return
	}

	v, err := a.repo.Upsert(r.Context(), uid, req.EntityID, req.Reference, req.VerseText,
		req.HighlightColor, req.Note)
	if err != nil {
		slog.Error("bookmarks: upsert", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "save failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, v)
}

// ---------------------------------------------------------------------------
// PUT /api/bookmarks/{entityID}/highlight  { "color": "#FFEB3B" | null }
// ---------------------------------------------------------------------------

type highlightRequest struct {
	Color *string `json:"color"`
}

func (a *API) SetHighlight(w http.ResponseWriter, r *http.Request) {
	uid, ok := userID(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	entityID := chi.URLParam(r, "entityID")

	var req highlightRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	// Auto-save the verse if it doesn't exist yet, so highlighting works
	// without a separate save step.
	existing, _ := a.repo.Get(r.Context(), uid, entityID)
	if existing == nil {
		if _, err := a.repo.Upsert(r.Context(), uid, entityID, "", "", req.Color, nil); err != nil {
			slog.Error("bookmarks: auto-save for highlight", "error", err)
			httpx.WriteError(w, http.StatusInternalServerError, "save failed")
			return
		}
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "saved"})
		return
	}

	if err := a.repo.UpdateHighlight(r.Context(), uid, entityID, req.Color); err != nil {
		slog.Error("bookmarks: update highlight", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "update failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// ---------------------------------------------------------------------------
// PUT /api/bookmarks/{entityID}/note  { "note": "..." | null }
// ---------------------------------------------------------------------------

type noteRequest struct {
	Note *string `json:"note"`
}

func (a *API) SetNote(w http.ResponseWriter, r *http.Request) {
	uid, ok := userID(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	entityID := chi.URLParam(r, "entityID")

	var req noteRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	existing, _ := a.repo.Get(r.Context(), uid, entityID)
	if existing == nil {
		if _, err := a.repo.Upsert(r.Context(), uid, entityID, "", "", nil, req.Note); err != nil {
			slog.Error("bookmarks: auto-save for note", "error", err)
			httpx.WriteError(w, http.StatusInternalServerError, "save failed")
			return
		}
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "saved"})
		return
	}

	if err := a.repo.UpdateNote(r.Context(), uid, entityID, req.Note); err != nil {
		slog.Error("bookmarks: update note", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "update failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// ---------------------------------------------------------------------------
// DELETE /api/bookmarks/{entityID}
// ---------------------------------------------------------------------------

func (a *API) Delete(w http.ResponseWriter, r *http.Request) {
	uid, ok := userID(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	entityID := chi.URLParam(r, "entityID")

	if err := a.repo.Delete(r.Context(), uid, entityID); err != nil {
		slog.Error("bookmarks: delete", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ---------------------------------------------------------------------------
// DELETE /api/bookmarks/{id}  (by bookmark UUID)
// ---------------------------------------------------------------------------

func (a *API) DeleteByID(w http.ResponseWriter, r *http.Request) {
	uid, ok := userID(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	id := chi.URLParam(r, "id")

	if err := a.repo.DeleteByID(r.Context(), uid, id); err != nil {
		slog.Error("bookmarks: delete by id", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
