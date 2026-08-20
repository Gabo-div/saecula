package main

// Integration tests. They wire the real services exactly as main.run does
// and serve them over httptest, exercising every public and protected
// endpoint against the dockerised Postgres + Neo4j.
//
// When the stores are not reachable the whole suite skips quietly, so
// `go test ./...` still passes on machines without the docker stack. Run
// `docker compose up -d` (+ seed) to exercise it, or `scripts/e2e.sh`.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"saecula/back/internal/auth"
	"saecula/back/internal/bible"
	"saecula/back/internal/bookmarks"
	"saecula/back/internal/calendar"
	"saecula/back/internal/catechism"
	"saecula/back/internal/config"
	"saecula/back/internal/db"
	"saecula/back/internal/readings"
	"saecula/back/internal/server"
	"saecula/back/internal/streak"
	"saecula/back/internal/timeline"
)

var testServer *httptest.Server

func TestMain(m *testing.M) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, "integration: config:", err)
		os.Exit(0)
	}

	pool, err := db.NewPostgresPool(ctx, cfg.PostgresDSN)
	if err != nil {
		fmt.Fprintln(os.Stderr, "integration: postgres not reachable, skipping:", err)
		os.Exit(0)
	}
	defer pool.Close()

	driver, err := db.NewNeo4jDriver(ctx, cfg.Neo4jURI, cfg.Neo4jUser, cfg.Neo4jPassword)
	if err != nil {
		fmt.Fprintln(os.Stderr, "integration: neo4j not reachable, skipping:", err)
		os.Exit(0)
	}
	defer func() { _ = driver.Close(ctx) }()

	// Mirror the wiring in run() exactly.
	tokens := auth.NewTokenManager(cfg.JWTSecret, cfg.JWTExpiration)
	userRepo := auth.NewPostgresUserRepository(pool)
	graphRepo := timeline.NewNeo4jGraphRepository(driver)
	textRepo := timeline.NewPostgresTextRepository(pool)
	bibleGraphRepo := bible.NewNeo4jGraphRepository(driver)
	bibleTextRepo := bible.NewPostgresTextRepository(pool)
	readingsGraphRepo := readings.NewNeo4jGraphRepository(driver)
	readingsTextRepo := readings.NewPostgresTextRepository(pool)

	authAPI := auth.NewAPI(userRepo, tokens)
	timelineAPI := timeline.NewAPI(graphRepo, textRepo)
	bibleAPI := bible.NewAPI(bibleGraphRepo, bibleTextRepo)
	readingsAPI := readings.NewAPI(readingsGraphRepo, readingsTextRepo)
	calendarAPI, err := calendar.NewAPI()
	if err != nil {
		fmt.Fprintln(os.Stderr, "integration: calendar:", err)
		os.Exit(1)
	}
	catechismAPI := catechism.NewAPI(pool)
	streakAPI := streak.NewAPI(streak.NewPostgresRepository(pool))
	bookmarksAPI := bookmarks.NewAPI(bookmarks.NewPostgresRepository(pool))

	srv := server.New(server.Config{
		Addr:           "127.0.0.1:0",
		AuthMiddleware: auth.Middleware(tokens),
		PublicAPIs:     []server.API{authAPI},
		ProtectedAPIs:  []server.API{timelineAPI, bibleAPI, readingsAPI, calendarAPI, catechismAPI, streakAPI, bookmarksAPI},
	})
	testServer = httptest.NewServer(srv.Handler())
	defer testServer.Close()

	os.Exit(m.Run())
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func do(t *testing.T, method, path string, body any, token string) (*http.Response, []byte) {
	t.Helper()
	var rdr io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		rdr = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, testServer.URL+path, rdr)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	defer func() { _ = resp.Body.Close() }()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("%s %s: read body: %v", method, path, err)
	}
	return resp, raw
}

func decode[T any](t *testing.T, raw []byte) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatalf("decode response: %v\n%s", err, raw)
	}
	return v
}

// authToken registers a throwaway user and returns a Bearer token for the
// protected endpoints. A fresh email keeps re-runs green against a
// persistent database.
func authToken(t *testing.T) string {
	t.Helper()
	email := fmt.Sprintf("itest-%d@example.com", time.Now().UnixNano())
	resp, raw := do(t, http.MethodPost, "/auth/register", map[string]string{
		"email": email, "password": "correct-horse",
	}, "")
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("authToken register = %d (%s)", resp.StatusCode, raw)
	}
	created := decode[authResponse](t, raw)
	if created.Token == "" {
		t.Fatalf("authToken got empty token: %+v", created)
	}
	return created.Token
}

// ---------------------------------------------------------------------------
// health & auth
// ---------------------------------------------------------------------------

type authResponse struct {
	Token string `json:"token"`
	User  struct {
		ID    string `json:"id"`
		Email string `json:"email"`
	} `json:"user"`
}

func TestHealth(t *testing.T) {
	resp, raw := do(t, http.MethodGet, "/health", nil, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET /health = %d, want 200 (%s)", resp.StatusCode, raw)
	}
	body := decode[map[string]string](t, raw)
	if body["status"] != "ok" {
		t.Fatalf("GET /health body = %v, want status ok", body)
	}
}

func TestAuthRegisterLogin(t *testing.T) {
	email := fmt.Sprintf("itest-%d@example.com", time.Now().UnixNano())

	// Register succeeds and returns a token.
	resp, raw := do(t, http.MethodPost, "/auth/register", map[string]string{
		"email": email, "password": "correct-horse",
	}, "")
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("register = %d, want 201 (%s)", resp.StatusCode, raw)
	}
	created := decode[authResponse](t, raw)
	if created.Token == "" || created.User.ID == "" || created.User.Email != email {
		t.Fatalf("register payload malformed: %+v", created)
	}

	// Duplicate email conflicts.
	resp, raw = do(t, http.MethodPost, "/auth/register", map[string]string{
		"email": email, "password": "correct-horse",
	}, "")
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("duplicate register = %d, want 409 (%s)", resp.StatusCode, raw)
	}

	// Login with the right password works.
	resp, raw = do(t, http.MethodPost, "/auth/login", map[string]string{
		"email": email, "password": "correct-horse",
	}, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("login = %d, want 200 (%s)", resp.StatusCode, raw)
	}
	logged := decode[authResponse](t, raw)
	if logged.Token == "" {
		t.Fatalf("login returned no token: %+v", logged)
	}

	// Wrong password is rejected without leaking that the email exists.
	resp, raw = do(t, http.MethodPost, "/auth/login", map[string]string{
		"email": email, "password": "wrong-password",
	}, "")
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("bad login = %d, want 401 (%s)", resp.StatusCode, raw)
	}

	// Malformed input is rejected up front.
	for _, tc := range []struct {
		name string
		body any
	}{
		{"short password", map[string]string{"email": email, "password": "short"}},
		{"bad email", map[string]string{"email": "not-an-email", "password": "long-enough-pass"}},
		{"invalid json", "{not json"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			resp, raw := do(t, http.MethodPost, "/auth/register", tc.body, "")
			if resp.StatusCode != http.StatusBadRequest {
				t.Fatalf("register %s = %d, want 400 (%s)", tc.name, resp.StatusCode, raw)
			}
		})
	}
}

func TestProtectedRequiresToken(t *testing.T) {
	for _, path := range []string{
		"/api/timeline?start_year=0&end_year=100",
		"/api/bible/books?lang=es",
		"/api/readings/2025-11-30?lang=es",
		"/api/calendar/2025-12-25?lang=en",
		"/api/catechism/1?lang=en",
	} {
		resp, _ := do(t, http.MethodGet, path, nil, "")
		if resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("GET %s without token = %d, want 401", path, resp.StatusCode)
		}
	}
}

// ---------------------------------------------------------------------------
// bible
// ---------------------------------------------------------------------------

func TestBibleBooksAndTranslations(t *testing.T) {
	token := authToken(t)

	resp, raw := do(t, http.MethodGet, "/api/bible/books?lang=es", nil, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("books = %d, want 200 (%s)", resp.StatusCode, raw)
	}
	books := decode[struct {
		Count int `json:"count"`
		Books []struct {
			Code string `json:"code"`
			Name string `json:"name"`
		} `json:"books"`
	}](t, raw)
	if books.Count == 0 || len(books.Books) != books.Count {
		t.Fatalf("books count mismatch: %+v", books)
	}
	if books.Books[0].Code == "" || books.Books[0].Name == "" {
		t.Fatalf("first book malformed: %+v", books.Books[0])
	}

	resp, raw = do(t, http.MethodGet, "/api/bible/translations", nil, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("translations = %d, want 200 (%s)", resp.StatusCode, raw)
	}
	tr := decode[struct {
		Translations []bible.Translation `json:"translations"`
	}](t, raw)
	if len(tr.Translations) == 0 {
		t.Fatalf("no translations seeded: %+v", tr)
	}
}

func TestBibleChapter(t *testing.T) {
	token := authToken(t)

	resp, raw := do(t, http.MethodGet, "/api/bible/JHN/3?lang=es", nil, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("chapter = %d, want 200 (%s)", resp.StatusCode, raw)
	}
	ch := decode[struct {
		BookCode string        `json:"book_code"`
		Chapter  int           `json:"chapter"`
		Lang     string        `json:"lang"`
		Verses   []bible.Verse `json:"verses"`
	}](t, raw)
	if ch.BookCode != "JHN" || ch.Chapter != 3 || ch.Lang != "es" {
		t.Fatalf("chapter metadata mismatch: %+v", ch)
	}
	if len(ch.Verses) == 0 || ch.Verses[0].Text == "" {
		t.Fatalf("expected es verses with text, got %d", len(ch.Verses))
	}
	// Verses must come back in numeric order (JHN.3.16 at index 15).
	if ch.Verses[0].Number != 1 {
		t.Fatalf("first verse number = %d, want 1", ch.Verses[0].Number)
	}

	// A language with no seeded corpus is a clean 404, not a 500.
	resp, raw = do(t, http.MethodGet, "/api/bible/JHN/3?lang=xx", nil, token)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("chapter in xx = %d, want 404 (%s)", resp.StatusCode, raw)
	}

	// Unknown book is a 404 too.
	resp, raw = do(t, http.MethodGet, "/api/bible/NOPE/1?lang=es", nil, token)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("unknown book = %d, want 404 (%s)", resp.StatusCode, raw)
	}
}

func TestBibleDailyAndSearch(t *testing.T) {
	token := authToken(t)

	resp, raw := do(t, http.MethodGet, "/api/bible/daily?lang=es", nil, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("daily = %d, want 200 (%s)", resp.StatusCode, raw)
	}
	daily := decode[struct {
		BookCode string        `json:"book_code"`
		Verses   []bible.Verse `json:"verses"`
	}](t, raw)
	if daily.BookCode == "" || len(daily.Verses) == 0 || daily.Verses[0].Text == "" {
		t.Fatalf("daily verse missing: %+v", daily)
	}

	resp, raw = do(t, http.MethodGet, "/api/bible/search?q=Dios&lang=es", nil, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("search = %d, want 200 (%s)", resp.StatusCode, raw)
	}
	search := decode[struct {
		Query   string `json:"query"`
		Results []struct {
			BookCode string `json:"book_code"`
			Text     string `json:"text"`
		} `json:"results"`
	}](t, raw)
	if search.Query != "Dios" {
		t.Fatalf("search echo = %q, want Dios", search.Query)
	}
	if len(search.Results) == 0 {
		t.Fatalf("search for Dios returned no hits")
	}
	if search.Results[0].Text == "" {
		t.Fatalf("search hit missing text: %+v", search.Results[0])
	}
}

// ---------------------------------------------------------------------------
// readings
// ---------------------------------------------------------------------------

func TestReadingsSeededDay(t *testing.T) {
	token := authToken(t)

	resp, raw := do(t, http.MethodGet, "/api/readings/2025-11-30?lang=es", nil, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("readings = %d, want 200 (%s)", resp.StatusCode, raw)
	}
	day := decode[struct {
		Date     string `json:"date"`
		Lang     string `json:"lang"`
		Readings []struct {
			Type   string `json:"type"`
			Verses []struct {
				EntityID string `json:"entity_id"`
				Text     string `json:"text"`
			} `json:"verses"`
		} `json:"readings"`
	}](t, raw)
	if day.Date != "2025-11-30" || day.Lang != "es" {
		t.Fatalf("readings metadata mismatch: %+v", day)
	}
	if len(day.Readings) == 0 {
		t.Fatalf("no readings for seeded day: %+v", day)
	}
	for _, r := range day.Readings {
		if r.Type == "" || len(r.Verses) == 0 {
			t.Fatalf("reading malformed: %+v", r)
		}
		if r.Verses[0].Text == "" {
			t.Fatalf("reading %s has no es text: %+v", r.Type, r)
		}
	}
}

func TestReadingsValidation(t *testing.T) {
	token := authToken(t)

	resp, _ := do(t, http.MethodGet, "/api/readings/not-a-date", nil, token)
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("bad date = %d, want 400", resp.StatusCode)
	}

	resp, raw := do(t, http.MethodGet, "/api/readings/1999-01-01?lang=es", nil, token)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("unseeded date = %d, want 404 (%s)", resp.StatusCode, raw)
	}
}

// ---------------------------------------------------------------------------
// catechism
// ---------------------------------------------------------------------------

func TestCatechism(t *testing.T) {
	token := authToken(t)

	resp, raw := do(t, http.MethodGet, "/api/catechism/1?lang=en", nil, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("paragraph 1 = %d, want 200 (%s)", resp.StatusCode, raw)
	}
	one := decode[struct {
		Number int    `json:"number"`
		Text   string `json:"text"`
	}](t, raw)
	if one.Number != 1 || one.Text == "" {
		t.Fatalf("paragraph 1 malformed: %+v", one)
	}

	resp, raw = do(t, http.MethodGet, "/api/catechism/search?q=God&lang=en", nil, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("search = %d, want 200 (%s)", resp.StatusCode, raw)
	}
	search := decode[struct {
		Query   string `json:"query"`
		Results []struct {
			Number  int    `json:"number"`
			Snippet string `json:"snippet"`
		} `json:"results"`
	}](t, raw)
	if search.Query != "God" || len(search.Results) == 0 {
		t.Fatalf("catechism search = %+v", search)
	}

	resp, raw = do(t, http.MethodGet, "/api/catechism?lang=es&from=1&limit=5", nil, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("list = %d, want 200 (%s)", resp.StatusCode, raw)
	}
	list := decode[struct {
		Lang       string `json:"lang"`
		HasMore    bool   `json:"has_more"`
		Paragraphs []struct {
			Number int `json:"number"`
		} `json:"paragraphs"`
	}](t, raw)
	if list.Lang != "es" || len(list.Paragraphs) != 5 || !list.HasMore {
		t.Fatalf("catechism list = %+v", list)
	}

	resp, _ = do(t, http.MethodGet, "/api/catechism/0", nil, token)
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("paragraph 0 = %d, want 400", resp.StatusCode)
	}
}

// ---------------------------------------------------------------------------
// calendar & timeline
// ---------------------------------------------------------------------------

func TestCalendar(t *testing.T) {
	token := authToken(t)

	resp, raw := do(t, http.MethodGet, "/api/calendar/2025-12-25?lang=en", nil, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("christmas = %d, want 200 (%s)", resp.StatusCode, raw)
	}
	day := decode[struct {
		Date         string `json:"date"`
		Celebrations []struct {
			Name string `json:"name"`
			Rank string `json:"rank"`
		} `json:"celebrations"`
	}](t, raw)
	if day.Date != "2025-12-25" || len(day.Celebrations) == 0 {
		t.Fatalf("christmas celebrations missing: %+v", day)
	}

	resp, raw = do(t, http.MethodGet, "/api/calendar/year/2025?lang=en", nil, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("year = %d, want 200 (%s)", resp.StatusCode, raw)
	}
	year := decode[struct {
		Year int                      `json:"year"`
		Days map[string][]interface{} `json:"days"`
	}](t, raw)
	if year.Year != 2025 || len(year.Days) == 0 {
		t.Fatalf("calendar year empty: %+v", year)
	}
}

func TestTimeline(t *testing.T) {
	token := authToken(t)

	resp, raw := do(t, http.MethodGet, "/api/timeline?start_year=0&end_year=100&lang=es", nil, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("timeline = %d, want 200 (%s)", resp.StatusCode, raw)
	}
	tl := decode[struct {
		StartYear int64 `json:"start_year"`
		EndYear   int64 `json:"end_year"`
	}](t, raw)
	if tl.StartYear != 0 || tl.EndYear != 100 {
		t.Fatalf("timeline bounds mismatch: %+v", tl)
	}

	resp, _ = do(t, http.MethodGet, "/api/timeline?start_year=100&end_year=0", nil, token)
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("inverted range = %d, want 400", resp.StatusCode)
	}
}

func TestStreakCheckinAndGet(t *testing.T) {
	token := authToken(t)

	// First check-in credits today.
	resp, raw := do(t, http.MethodPost, "/api/streak/checkin",
		map[string]string{"date": "2026-08-18", "activityType": "bible"}, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("checkin = %d, want 200 (%s)", resp.StatusCode, raw)
	}

	// A second check-in the same day is idempotent (still one day).
	resp, raw = do(t, http.MethodPost, "/api/streak/checkin",
		map[string]string{"date": "2026-08-18", "activityType": "prayer"}, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("second checkin = %d, want 200 (%s)", resp.StatusCode, raw)
	}

	resp, raw = do(t, http.MethodGet, "/api/streak?date=2026-08-18", nil, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("get streak = %d, want 200 (%s)", resp.StatusCode, raw)
	}
	s := decode[struct {
		Current       int    `json:"current"`
		Best          int    `json:"best"`
		LastActiveDay string `json:"lastActiveDay"`
		TodayDone     bool   `json:"todayDone"`
	}](t, raw)
	if s.Current != 1 || s.Best != 1 || !s.TodayDone || s.LastActiveDay != "2026-08-18" {
		t.Fatalf("streak summary mismatch: %+v", s)
	}

	// Unknown activity type is rejected.
	resp, _ = do(t, http.MethodPost, "/api/streak/checkin",
		map[string]string{"date": "2026-08-18", "activityType": "walk"}, token)
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("bad activityType = %d, want 400", resp.StatusCode)
	}
}

func TestBookmarkGroups(t *testing.T) {
	token := authToken(t)

	type sv struct {
		EntityID       string  `json:"entity_id"`
		GroupID        *string `json:"group_id"`
		HighlightColor *string `json:"highlight_color"`
		Note           *string `json:"note"`
	}

	// A standalone bookmark with a note on JHN.3.16.
	resp, raw := do(t, http.MethodPost, "/api/bookmarks", map[string]any{
		"entity_id": "JHN.3.16", "reference": "John 3:16", "verse_text": "For God so loved",
		"note": "single note",
	}, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("save single = %d (%s)", resp.StatusCode, raw)
	}

	// A group over JHN.3.16 + JHN.3.17 with a highlight — must NOT touch the single.
	resp, raw = do(t, http.MethodPost, "/api/bookmarks/group", map[string]any{
		"verses": []map[string]string{
			{"entity_id": "JHN.3.16", "reference": "John 3:16", "verse_text": "For God so loved"},
			{"entity_id": "JHN.3.17", "reference": "John 3:17", "verse_text": "For God sent not"},
		},
		"highlight_color": "#F5D063",
	}, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("create group = %d (%s)", resp.StatusCode, raw)
	}
	grp := decode[struct {
		Verses []sv `json:"verses"`
	}](t, raw)
	if len(grp.Verses) != 2 || grp.Verses[0].GroupID == nil {
		t.Fatalf("group payload malformed: %+v", grp)
	}
	groupID := *grp.Verses[0].GroupID

	// List: the single (note, group_id null) survives alongside the 2 group rows.
	_, raw = do(t, http.MethodGet, "/api/bookmarks", nil, token)
	list := decode[struct {
		Verses []sv `json:"verses"`
	}](t, raw)
	var singles, grouped int
	for _, v := range list.Verses {
		if v.GroupID == nil && v.EntityID == "JHN.3.16" && v.Note != nil && *v.Note == "single note" {
			singles++
		}
		if v.GroupID != nil && *v.GroupID == groupID {
			grouped++
		}
	}
	if singles != 1 {
		t.Fatalf("standalone JHN.3.16 note was clobbered; singles=%d list=%+v", singles, list.Verses)
	}
	if grouped != 2 {
		t.Fatalf("expected 2 group rows, got %d", grouped)
	}

	// Delete the group: standalone bookmark stays.
	resp, _ = do(t, http.MethodDelete, "/api/bookmarks/group/"+groupID, nil, token)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete group = %d", resp.StatusCode)
	}
	_, raw = do(t, http.MethodGet, "/api/bookmarks", nil, token)
	after := decode[struct {
		Verses []sv `json:"verses"`
	}](t, raw)
	for _, v := range after.Verses {
		if v.GroupID != nil && *v.GroupID == groupID {
			t.Fatalf("group rows still present after delete")
		}
	}
}
