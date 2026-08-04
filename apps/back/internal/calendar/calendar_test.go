package calendar

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func newTestAPI(t *testing.T) *API {
	t.Helper()
	api, err := NewAPI()
	if err != nil {
		t.Fatalf("NewAPI: %v", err)
	}
	// Pin "today" to a date inside the embedded range.
	api.now = func() time.Time { return time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC) }
	return api
}

func doGet(t *testing.T, api *API, path string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	rec := httptest.NewRecorder()
	api.Routes().ServeHTTP(rec, req)
	return rec
}

func TestByDateSanctoral(t *testing.T) {
	api := newTestAPI(t)
	rec := doGet(t, api, "/2026-01-02?lang=es")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var got dayResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Lang != "es" || got.Date != "2026-01-02" {
		t.Fatalf("meta = %+v", got)
	}
	if len(got.Celebrations) == 0 {
		t.Fatal("expected at least one celebration")
	}
	c := got.Celebrations[0]
	if !c.Sanctoral || c.Rank != "MEMORIAL" || c.Name == "" || c.RankName == "" {
		t.Fatalf("celebration = %+v", c)
	}
}

func TestByDateOutOfRangeIsEmptyNot404(t *testing.T) {
	api := newTestAPI(t)
	rec := doGet(t, api, "/1900-01-01")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var got dayResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &got)
	if got.Celebrations == nil || len(got.Celebrations) != 0 {
		t.Fatalf("want empty non-nil list, got %+v", got.Celebrations)
	}
}

func TestBadDate(t *testing.T) {
	api := newTestAPI(t)
	if rec := doGet(t, api, "/nope"); rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestDailyUsesClock(t *testing.T) {
	api := newTestAPI(t)
	rec := doGet(t, api, "/daily?lang=en")
	var got dayResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &got)
	if got.Date != "2026-01-01" {
		t.Fatalf("date = %q, want 2026-01-01", got.Date)
	}
	if len(got.Celebrations) == 0 || got.Celebrations[0].Rank != "SOLEMNITY" {
		t.Fatalf("want Mary Mother of God solemnity, got %+v", got.Celebrations)
	}
}

func TestYear(t *testing.T) {
	api := newTestAPI(t)
	rec := doGet(t, api, "/year/2026?lang=la")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var got yearResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Year != 2026 || got.Lang != "la" {
		t.Fatalf("meta = %+v", got)
	}
	// A full gregorian year of dates, none leaking from adjacent years.
	if len(got.Days) < 360 {
		t.Fatalf("expected ~365 dates, got %d", len(got.Days))
	}
	for date := range got.Days {
		if date[:5] != "2026-" {
			t.Fatalf("leaked date from another year: %s", date)
		}
	}
}

func TestBadYear(t *testing.T) {
	api := newTestAPI(t)
	if rec := doGet(t, api, "/year/abc"); rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}
