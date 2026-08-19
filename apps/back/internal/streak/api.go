package streak

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"saecula/back/internal/auth"
	"saecula/back/internal/httpx"
)

const dateLayout = "2006-01-02"

// maxHistoryDays bounds a history query to keep the scan small.
const maxHistoryDays = 366

// API serves the streak endpoints (per-user, JWT-protected).
type API struct {
	repo Repository
	now  func() time.Time // injected clock; only the no-date fallback uses it
}

func NewAPI(repo Repository) *API {
	return &API{repo: repo, now: time.Now}
}

func (a *API) Pattern() string { return "/streak" }

func (a *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/checkin", a.Checkin)
	r.Get("/", a.Get)
	r.Get("/history", a.History)
	return r
}

type checkinRequest struct {
	Date         string `json:"date"`
	ActivityType string `json:"activityType"`
}

func (a *API) Checkin(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	var req checkinRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	today, err := time.Parse(dateLayout, req.Date)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "date must be YYYY-MM-DD")
		return
	}
	if !ValidActivityType(req.ActivityType) {
		httpx.WriteError(w, http.StatusBadRequest, "unknown activityType")
		return
	}
	if err := a.repo.Upsert(r.Context(), userID, req.Date, req.ActivityType); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "check-in failed")
		return
	}
	a.writeSummary(w, r, userID, today)
}

func (a *API) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	today := a.now().UTC()
	if q := r.URL.Query().Get("date"); q != "" {
		parsed, err := time.Parse(dateLayout, q)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "date must be YYYY-MM-DD")
			return
		}
		today = parsed
	}
	a.writeSummary(w, r, userID, today)
}

func (a *API) writeSummary(w http.ResponseWriter, r *http.Request, userID string, today time.Time) {
	days, err := a.repo.ActiveDays(r.Context(), userID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "load streak failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, Compute(days, today))
}

func (a *API) History(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	from, err := time.Parse(dateLayout, r.URL.Query().Get("from"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "from must be YYYY-MM-DD")
		return
	}
	to, err := time.Parse(dateLayout, r.URL.Query().Get("to"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "to must be YYYY-MM-DD")
		return
	}
	if to.Before(from) || to.Sub(from) > maxHistoryDays*24*time.Hour {
		httpx.WriteError(w, http.StatusBadRequest, "range must be ordered and within a year")
		return
	}
	entries, err := a.repo.History(r.Context(), userID, from.Format(dateLayout), to.Format(dateLayout))
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "load history failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"entries": entries})
}
