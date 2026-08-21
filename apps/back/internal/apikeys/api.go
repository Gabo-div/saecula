package apikeys

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"saecula/apikey"
	"saecula/back/internal/auth"
	"saecula/back/internal/httpx"
)

// maxKeysPerUser bounds how many live keys one account can hold, so a
// compromised session cannot mint credentials without limit.
const maxKeysPerUser = 20

// maxNameLen matches api_keys.name in the schema.
const maxNameLen = 64

// defaultUsageDays is the window the dashboard asks for when it does not say.
const defaultUsageDays = 30

// maxUsageDays bounds the usage window so one request cannot scan the whole table.
const maxUsageDays = 365

// API lets a signed-in user mint, list and revoke the API keys that
// authenticate the public MCP endpoint, and read their usage.
type API struct {
	repo Repository
}

func NewAPI(repo Repository) *API { return &API{repo: repo} }

func (a *API) Pattern() string { return "/keys" }

func (a *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/", a.Create)
	r.Get("/", a.List)
	r.Get("/usage", a.Usage)
	r.Delete("/{id}", a.Revoke)
	return r
}

type createRequest struct {
	Name string `json:"name"`
}

type createResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Prefix    string    `json:"prefix"`
	CreatedAt time.Time `json:"created_at"`
	// Key is the plaintext secret. It is returned by this endpoint only, once,
	// and is not recoverable afterwards — only its hash is stored.
	Key string `json:"key"`
}

type summaryResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Prefix      string    `json:"prefix"`
	CreatedAt   time.Time `json:"created_at"`
	TotalCalls  int64     `json:"total_calls"`
	TotalErrors int64     `json:"total_errors"`
}

type usageResponse struct {
	KeyID  string `json:"key_id"`
	Prefix string `json:"prefix"`
	Day    string `json:"day"`
	Tool   string `json:"tool"`
	Calls  int32  `json:"calls"`
	Errors int32  `json:"errors"`
}

// POST /api/keys
func (a *API) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}

	var req createRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		httpx.WriteError(w, http.StatusBadRequest, "name is required")
		return
	}
	if len(req.Name) > maxNameLen {
		httpx.WriteError(w, http.StatusBadRequest, "name is too long")
		return
	}

	existing, err := a.repo.List(r.Context(), userID)
	if err != nil {
		slog.Error("list api keys", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "could not create the key")
		return
	}
	if len(existing) >= maxKeysPerUser {
		httpx.WriteError(w, http.StatusConflict, "too many active keys, revoke one first")
		return
	}

	plaintext, hash, public, err := apikey.Generate()
	if err != nil {
		slog.Error("generate api key", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "could not create the key")
		return
	}

	created, err := a.repo.Create(r.Context(), userID, hash, public, req.Name)
	if err != nil {
		slog.Error("create api key", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "could not create the key")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, createResponse{
		ID:        created.ID,
		Name:      created.Name,
		Prefix:    created.Prefix,
		CreatedAt: created.CreatedAt,
		Key:       plaintext,
	})
}

// GET /api/keys
func (a *API) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}

	keys, err := a.repo.List(r.Context(), userID)
	if err != nil {
		slog.Error("list api keys", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "could not read the keys")
		return
	}

	out := make([]summaryResponse, 0, len(keys))
	for _, k := range keys {
		out = append(out, summaryResponse{
			ID:          k.ID,
			Name:        k.Name,
			Prefix:      k.Prefix,
			CreatedAt:   k.CreatedAt,
			TotalCalls:  k.TotalCalls,
			TotalErrors: k.TotalErrors,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"keys": out})
}

// GET /api/keys/usage?days=30
func (a *API) Usage(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}

	days := defaultUsageDays
	if raw := r.URL.Query().Get("days"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > maxUsageDays {
			httpx.WriteError(w, http.StatusBadRequest, "days must be between 1 and 365")
			return
		}
		days = n
	}

	since := time.Now().UTC().AddDate(0, 0, -days).Truncate(24 * time.Hour)
	rows, err := a.repo.Usage(r.Context(), userID, since)
	if err != nil {
		slog.Error("api key usage", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "could not read usage")
		return
	}

	out := make([]usageResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, usageResponse{
			KeyID:  row.KeyID,
			Prefix: row.Prefix,
			Day:    row.Day.Format(time.DateOnly),
			Tool:   row.Tool,
			Calls:  row.Calls,
			Errors: row.Errors,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"usage": out})
}

// DELETE /api/keys/{id}
func (a *API) Revoke(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}

	id := chi.URLParam(r, "id")
	// A malformed id is a key this user does not have, not a server error:
	// without this it reaches Postgres as a bad uuid cast and surfaces as 500.
	if uuid.Validate(id) != nil {
		httpx.WriteError(w, http.StatusNotFound, "key not found")
		return
	}

	err := a.repo.Revoke(r.Context(), id, userID)
	if errors.Is(err, ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "key not found")
		return
	}
	if err != nil {
		slog.Error("revoke api key", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "could not revoke the key")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
