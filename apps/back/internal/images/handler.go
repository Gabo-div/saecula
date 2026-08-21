// Package images serves curated art metadata (URL + attribution) from the
// image_assets catalog. Bytes live in R2; this module only hands out URLs.
package images

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"saecula/back/internal/httpx"
)

// Background is one background-pool member: the 1200w URL and its attribution.
type Background struct {
	URL         string `json:"url"`
	Attribution string `json:"attribution"`
}

// BackgroundRepository returns the background-eligible pool.
type BackgroundRepository interface {
	Backgrounds(ctx context.Context) ([]Background, error)
}

type API struct {
	repo BackgroundRepository
	now  func() time.Time
}

func NewAPI(repo BackgroundRepository) *API {
	return &API{repo: repo, now: time.Now}
}

func (a *API) Pattern() string { return "/images" }

func (a *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/background", a.Background)
	return r
}

// Background picks the day's background deterministically by day-of-year, so a
// given date always yields the same image (the rotation the client used to do
// locally, moved server-side).
func (a *API) Background(w http.ResponseWriter, r *http.Request) {
	pool, err := a.repo.Backgrounds(r.Context())
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "load backgrounds")
		return
	}
	if len(pool) == 0 {
		httpx.WriteError(w, http.StatusNotFound, "no backgrounds")
		return
	}
	idx := a.now().UTC().YearDay() % len(pool)
	httpx.WriteJSON(w, http.StatusOK, pool[idx])
}
