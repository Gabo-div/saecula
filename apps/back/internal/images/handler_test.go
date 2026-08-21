package images

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeRepo struct{ pool []Background }

func (f fakeRepo) Backgrounds(context.Context) ([]Background, error) { return f.pool, nil }

func TestBackgroundReturnsPoolMemberWithAttribution(t *testing.T) {
	repo := fakeRepo{pool: []Background{
		{URL: "https://img/a-1200.jpg", Attribution: "Artist A (PD)"},
		{URL: "https://img/b-1200.jpg", Attribution: "Artist B (PD)"},
	}}
	api := NewAPI(repo)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/background", nil)
	api.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var got struct{ URL, Attribution string }
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.URL == "" || got.Attribution == "" {
		t.Fatalf("empty payload: %+v", got)
	}
}

func TestBackgroundEmptyPoolIs404(t *testing.T) {
	api := NewAPI(fakeRepo{})
	rec := httptest.NewRecorder()
	api.Routes().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/background", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}
