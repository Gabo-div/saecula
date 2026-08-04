// Package calendar serves the General Roman liturgical calendar: the
// sanctoral cycle (saints — the "santoral") and the temporal cycle (seasons,
// Sundays, solemnities and feasts of the Lord — the "celebrations").
//
// The data is precomputed from romcal at build time (see gen/gen.mjs) and
// embedded, so serving needs neither a database nor a JS runtime. romcal's
// output for a gregorian year is deterministic; regenerate to widen the range.
package calendar

import (
	"embed"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"saecula/back/internal/httpx"
)

//go:embed data/calendar.en.json data/calendar.es.json data/calendar.la.json
var dataFS embed.FS

// Celebration is one liturgical day entry. A date can carry several (the
// primary celebration first, then optional memorials). Field tags match the
// embedded JSON so the same struct parses the file and serves the response.
type Celebration struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Rank       string   `json:"rank"`
	RankName   string   `json:"rank_name"`
	Colors     []string `json:"colors"`
	Season     string   `json:"season"`
	SeasonName string   `json:"season_name"`
	HolyDay    bool     `json:"holy_day"`
	Optional   bool     `json:"optional"`
	Sanctoral  bool     `json:"sanctoral"` // true = santoral cycle, false = proper of time
	Titles     []string `json:"titles,omitempty"`
}

// API serves the liturgical calendar. All data lives in memory, keyed by
// language then ISO date.
type API struct {
	byLang map[string]map[string][]Celebration
	now    func() time.Time // injected clock so "today" is testable
}

// NewAPI parses the embedded calendars once. It fails fast if an embedded
// file is missing or malformed — that is a build error, not a runtime one.
func NewAPI() (*API, error) {
	byLang := make(map[string]map[string][]Celebration, len(langFiles))
	for lang, file := range langFiles {
		raw, err := dataFS.ReadFile(file)
		if err != nil {
			return nil, fmt.Errorf("calendar: read %s: %w", file, err)
		}
		var days map[string][]Celebration
		if err := json.Unmarshal(raw, &days); err != nil {
			return nil, fmt.Errorf("calendar: parse %s: %w", file, err)
		}
		byLang[lang] = days
	}
	return &API{byLang: byLang, now: time.Now}, nil
}

var langFiles = map[string]string{
	"en": "data/calendar.en.json",
	"es": "data/calendar.es.json",
	"la": "data/calendar.la.json",
}

// Pattern is where the server mounts this API (under the protected group).
func (a *API) Pattern() string { return "/calendar" }

// Routes exposes the calendar endpoints.
func (a *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/daily", a.Daily)
	r.Get("/year/{year}", a.Year)
	r.Get("/{date}", a.ByDate)
	return r
}

// ---------------------------------------------------------------------------
// GET /api/calendar/daily?lang=          (today)
// GET /api/calendar/{date}?lang=         (date = YYYY-MM-DD)
// GET /api/calendar/year/{year}?lang=    (whole gregorian year)
// ---------------------------------------------------------------------------

type dayResponse struct {
	Date         string        `json:"date"`
	Lang         string        `json:"lang"`
	Celebrations []Celebration `json:"celebrations"`
}

type yearResponse struct {
	Year int                      `json:"year"`
	Lang string                   `json:"lang"`
	Days map[string][]Celebration `json:"days"`
}

func (a *API) Daily(w http.ResponseWriter, r *http.Request) {
	a.serveDay(w, r, a.now().UTC().Format("2006-01-02"))
}

func (a *API) ByDate(w http.ResponseWriter, r *http.Request) {
	date := chi.URLParam(r, "date")
	if _, err := time.Parse("2006-01-02", date); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "date must be YYYY-MM-DD")
		return
	}
	a.serveDay(w, r, date)
}

func (a *API) serveDay(w http.ResponseWriter, r *http.Request, date string) {
	lang, days := a.langData(r)
	// A date outside the precomputed range is not an error — the calendar
	// simply has nothing for it. Return an empty list, never a stub message.
	cels := days[date]
	if cels == nil {
		cels = []Celebration{}
	}
	httpx.WriteJSON(w, http.StatusOK, dayResponse{Date: date, Lang: lang, Celebrations: cels})
}

func (a *API) Year(w http.ResponseWriter, r *http.Request) {
	yearStr := chi.URLParam(r, "year")
	year, err := strconv.Atoi(yearStr)
	if err != nil || year < 1 || year > 9999 {
		httpx.WriteError(w, http.StatusBadRequest, "year must be a 4-digit number")
		return
	}
	lang, days := a.langData(r)

	prefix := fmt.Sprintf("%04d-", year)
	out := make(map[string][]Celebration)
	for date, cels := range days {
		if len(date) >= 5 && date[:5] == prefix {
			out[date] = cels
		}
	}
	httpx.WriteJSON(w, http.StatusOK, yearResponse{Year: year, Lang: lang, Days: out})
}

// langData resolves the requested language (defaulting to English) and
// returns it alongside that language's date→celebrations map.
func (a *API) langData(r *http.Request) (string, map[string][]Celebration) {
	lang := r.URL.Query().Get("lang")
	if days, ok := a.byLang[lang]; ok {
		return lang, days
	}
	return "en", a.byLang["en"]
}
