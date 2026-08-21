package apikeys

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"saecula/apikey"
	"saecula/back/internal/ratelimit"
)

type stubRepo struct {
	Repository
	hash string
	key  Key
	err  error
}

func (s stubRepo) ByHash(_ context.Context, hash string) (Key, error) {
	if s.err != nil {
		return Key{}, s.err
	}
	if hash != s.hash {
		return Key{}, ErrNotFound
	}
	return s.key, nil
}

// guarded wraps a handler that records the key it saw, so a test can assert
// both the status and whether the request reached the other side.
func guarded(repo Repository, perMin int) (http.Handler, *Key) {
	var seen Key
	h := Middleware(repo, ratelimit.New(perMin))(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			if key, ok := FromContext(r.Context()); ok {
				seen = key
			}
			w.WriteHeader(http.StatusOK)
		}))
	return h, &seen
}

func request(auth string) *http.Request {
	r := httptest.NewRequest(http.MethodPost, "/mcp", nil)
	if auth != "" {
		r.Header.Set("Authorization", auth)
	}
	return r
}

func TestMiddlewareRejectsBadCredentials(t *testing.T) {
	live, _, _, err := apikey.Generate()
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	repo := stubRepo{hash: apikey.Hash(live), key: Key{ID: "k1", UserID: "u1"}}

	cases := []struct {
		name string
		auth string
	}{
		{"no header", ""},
		{"not bearer", "Basic " + live},
		{"foreign token shape", "Bearer eyJhbGciOiJIUzI1NiJ9.e30.x"},
		{"prefix only", "Bearer " + apikey.Prefix},
		{"unknown key", "Bearer " + apikey.Prefix + "AAAAAAAAAAAAAAAAAAAA"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h, seen := guarded(repo, 0)
			w := httptest.NewRecorder()
			h.ServeHTTP(w, request(tc.auth))

			if w.Code != http.StatusUnauthorized {
				t.Errorf("status = %d, want 401", w.Code)
			}
			if seen.ID != "" {
				t.Errorf("request reached the handler with key %+v", *seen)
			}
		})
	}
}

func TestMiddlewareAcceptsALiveKey(t *testing.T) {
	live, _, _, err := apikey.Generate()
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	h, seen := guarded(stubRepo{hash: apikey.Hash(live), key: Key{ID: "k1", UserID: "u1"}}, 0)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, request("Bearer "+live))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if seen.ID != "k1" || seen.UserID != "u1" {
		t.Errorf("handler saw %+v, want the authenticated key", *seen)
	}
}

func TestMiddlewareThrottlesPerKey(t *testing.T) {
	live, _, _, err := apikey.Generate()
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	h, _ := guarded(stubRepo{hash: apikey.Hash(live), key: Key{ID: "k1"}}, 1)

	first := httptest.NewRecorder()
	h.ServeHTTP(first, request("Bearer "+live))
	if first.Code != http.StatusOK {
		t.Fatalf("first request status = %d, want 200", first.Code)
	}

	second := httptest.NewRecorder()
	h.ServeHTTP(second, request("Bearer "+live))
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("second request status = %d, want 429", second.Code)
	}
	if got := second.Header().Get("Retry-After"); got == "" {
		t.Error("429 response is missing Retry-After")
	}
}

func TestMiddlewareFailsClosedOnLookupError(t *testing.T) {
	live, _, _, err := apikey.Generate()
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	h, seen := guarded(stubRepo{err: errors.New("connection refused")}, 0)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, request("Bearer "+live))

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500 — a database outage must not read as a valid key", w.Code)
	}
	if seen.ID != "" {
		t.Errorf("request reached the handler with key %+v", *seen)
	}
}
