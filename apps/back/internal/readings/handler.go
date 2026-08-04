package readings

import (
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"saecula/back/internal/httpx"
	"saecula/canon"
)

// API serves the daily Mass readings: verse references and localized text
// for a liturgical day.
type API struct {
	graph GraphRepository
	texts TextRepository
	now   func() time.Time // injected clock so "today" is testable
}

func NewAPI(graph GraphRepository, texts TextRepository) *API {
	return &API{graph: graph, texts: texts, now: time.Now}
}

// Pattern is where the server mounts this API (under the protected group).
func (a *API) Pattern() string { return "/readings" }

// Routes exposes the readings endpoints.
func (a *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/daily", a.Daily)
	r.Get("/{date}", a.ByDate)
	return r
}

// ---------------------------------------------------------------------------
// GET /api/readings/daily?lang=&translation=  (today)
// GET /api/readings/{date}?lang=&translation=  (date = YYYY-MM-DD)
// ---------------------------------------------------------------------------

type verseResponse struct {
	EntityID string `json:"entity_id"`
	BookCode string `json:"book_code"`
	Chapter  int    `json:"chapter"`
	Number   int    `json:"number"`
	Text     string `json:"text,omitempty"`
}

type readingResponse struct {
	Type      string          `json:"type"`
	Reference string          `json:"reference"`
	Verses    []verseResponse `json:"verses"`
}

type dayResponse struct {
	Date       string            `json:"date"`
	Title      string            `json:"title,omitempty"`
	Lectionary string            `json:"lectionary,omitempty"`
	Lang       string            `json:"lang"`
	Readings   []readingResponse `json:"readings"`
}

func (a *API) Daily(w http.ResponseWriter, r *http.Request) {
	a.serve(w, r, a.now().UTC().Format("2006-01-02"))
}

func (a *API) ByDate(w http.ResponseWriter, r *http.Request) {
	date := chi.URLParam(r, "date")
	if _, err := time.Parse("2006-01-02", date); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "date must be YYYY-MM-DD")
		return
	}
	a.serve(w, r, date)
}

func (a *API) serve(w http.ResponseWriter, r *http.Request, date string) {
	lang := langParam(r)
	translation := r.URL.Query().Get("translation")

	day, err := a.graph.DayReadings(r.Context(), date)
	if err != nil {
		slog.Error("readings: day lookup", "error", err, "date", date)
		httpx.WriteError(w, http.StatusInternalServerError, "graph query failed")
		return
	}
	if day == nil {
		httpx.WriteError(w, http.StatusNotFound, fmt.Sprintf("no readings seeded for %s", date))
		return
	}

	// One batched text lookup for every verse across every reading.
	var allIDs []string
	for _, rd := range day.Readings {
		allIDs = append(allIDs, rd.VerseIDs...)
	}
	texts, err := a.texts.VerseTexts(r.Context(), allIDs, lang, translation)
	if err != nil {
		slog.Error("readings: verse texts", "error", err, "date", date)
		httpx.WriteError(w, http.StatusInternalServerError, "text lookup failed")
		return
	}

	readings := make([]readingResponse, 0, len(day.Readings))
	for _, rd := range day.Readings {
		if isAcclamation(rd.Type) {
			continue // the gospel acclamation (Alleluia) is not served
		}
		verses := make([]verseResponse, 0, len(rd.VerseIDs))
		for _, id := range rd.VerseIDs {
			book, chapter, number := splitEntity(id)
			v := verseResponse{EntityID: id, BookCode: book, Chapter: chapter, Number: number}
			if t, ok := texts[id]; ok {
				v.Text = t.Text
			}
			verses = append(verses, v)
		}
		readings = append(readings, readingResponse{
			Type:      rd.Type,
			Reference: buildReference(rd.VerseIDs, lang),
			Verses:    verses,
		})
	}
	sortReadings(readings)

	httpx.WriteJSON(w, http.StatusOK, dayResponse{
		Date:       day.Date,
		Title:      day.Title,
		Lectionary: day.Lectionary,
		Lang:       lang,
		Readings:   readings,
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

func splitEntity(entityID string) (book string, chapter, verse int) {
	parts := strings.Split(entityID, ".")
	if len(parts) != 3 {
		return "", 0, 0
	}
	chapter = atoiSafe(parts[1])
	verse = atoiSafe(parts[2])
	return parts[0], chapter, verse
}

func atoiSafe(s string) int {
	n := 0
	for _, r := range s {
		if r < '0' || r > '9' {
			return 0
		}
		n = n*10 + int(r-'0')
	}
	return n
}

// buildReference reconstructs a human citation from ordered verse IDs,
// collapsing consecutive verses into ranges: [WIS.12.13, WIS.12.16,
// WIS.12.17, WIS.12.18, WIS.12.19] → "Wisdom 12:13, 16-19". Verses are
// assumed pre-sorted by (chapter, verse).
func buildReference(ids []string, lang string) string {
	if len(ids) == 0 {
		return ""
	}
	bookCode, _, _ := splitEntity(ids[0])
	name := bookCode
	if b, ok := canon.ByCode(bookCode); ok {
		name = bookName(*b, lang)
	}

	var chapters []string // "12:13, 16-19" per chapter, in order
	curChapter := -1
	var parts []string
	rangeStart, rangeEnd := -1, -1

	flushRange := func() {
		if rangeStart < 0 {
			return
		}
		if rangeStart == rangeEnd {
			parts = append(parts, fmt.Sprintf("%d", rangeStart))
		} else {
			parts = append(parts, fmt.Sprintf("%d-%d", rangeStart, rangeEnd))
		}
		rangeStart, rangeEnd = -1, -1
	}
	flushChapter := func() {
		flushRange()
		if curChapter >= 0 && len(parts) > 0 {
			chapters = append(chapters, fmt.Sprintf("%d:%s", curChapter, strings.Join(parts, ", ")))
		}
		parts = nil
	}

	for _, id := range ids {
		_, ch, v := splitEntity(id)
		if ch != curChapter {
			flushChapter()
			curChapter = ch
		}
		switch {
		case rangeStart < 0:
			rangeStart, rangeEnd = v, v
		case v == rangeEnd+1:
			rangeEnd = v
		default:
			flushRange()
			rangeStart, rangeEnd = v, v
		}
	}
	flushChapter()

	return strings.TrimSpace(name + " " + strings.Join(chapters, "; "))
}

func bookName(b canon.Book, lang string) string {
	if lang == "es" {
		return b.NameES
	}
	return b.NameEN
}

// readingOrder ranks reading types into the sequence a Mass proclaims them;
// unknown types sort last, alphabetically.
var readingOrder = map[string]int{
	"reading_1":          0,
	"reading_i":          0,
	"responsorial_psalm": 1,
	"psalm":              1,
	"reading_2":          2,
	"reading_ii":         2,
	"sequence":           3,
	"gospel":             5,
}

// isAcclamation reports whether a reading type is the gospel acclamation
// (Alleluia / Verse before the Gospel), which the app does not serve.
func isAcclamation(t string) bool {
	switch t {
	case "alleluia", "gospel_acclamation", "verse_before_the_gospel":
		return true
	}
	return false
}

func sortReadings(readings []readingResponse) {
	rank := func(t string) int {
		if r, ok := readingOrder[t]; ok {
			return r
		}
		return 100
	}
	sort.SliceStable(readings, func(i, j int) bool {
		ri, rj := rank(readings[i].Type), rank(readings[j].Type)
		if ri != rj {
			return ri < rj
		}
		return readings[i].Type < readings[j].Type
	})
}
