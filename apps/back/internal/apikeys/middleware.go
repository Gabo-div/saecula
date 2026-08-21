package apikeys

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"saecula/apikey"
	"saecula/back/internal/httpx"
	"saecula/back/internal/ratelimit"
)

type contextKey string

const ctxKeyAPIKey contextKey = "saecula.api_key"

// retryAfterSeconds is the width of the rate-limit window, so a throttled
// caller waiting this long is always past it.
const retryAfterSeconds = "60"

// Middleware authenticates a request by API key and throttles it per key. It
// guards the public MCP endpoint, which is reachable without a session: the
// JWT middleware in internal/auth is deliberately not involved, so a leaked
// app token cannot be replayed here and a leaked key cannot reach /api.
func Middleware(repo Repository, limiter *ratelimit.Window) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			presented, ok := bearer(r)
			if !ok || !apikey.WellFormed(presented) {
				httpx.WriteError(w, http.StatusUnauthorized, "missing or malformed API key")
				return
			}

			key, err := repo.ByHash(r.Context(), apikey.Hash(presented))
			if err != nil {
				if !errors.Is(err, ErrNotFound) {
					slog.Error("api key lookup", "error", err)
					httpx.WriteError(w, http.StatusInternalServerError, "could not verify the API key")
					return
				}
				// Unknown and revoked are one answer on purpose. Only the
				// public fragment is logged — never the presented secret.
				slog.Warn("rejected api key", "prefix", apikey.Public(presented))
				httpx.WriteError(w, http.StatusUnauthorized, "invalid API key")
				return
			}

			if !limiter.Allow(key.ID) {
				w.Header().Set("Retry-After", retryAfterSeconds)
				httpx.WriteError(w, http.StatusTooManyRequests, "rate limit exceeded, slow down")
				return
			}

			next.ServeHTTP(w, r.WithContext(WithKey(r.Context(), key)))
		})
	}
}

// WithKey marks ctx as authenticated by key.
func WithKey(ctx context.Context, key Key) context.Context {
	return context.WithValue(ctx, ctxKeyAPIKey, key)
}

// FromContext returns the API key Middleware authenticated this request with.
func FromContext(ctx context.Context) (Key, bool) {
	key, ok := ctx.Value(ctxKeyAPIKey).(Key)
	return key, ok
}

func bearer(r *http.Request) (string, bool) {
	parts := strings.SplitN(r.Header.Get("Authorization"), " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return "", false
	}
	return strings.TrimSpace(parts[1]), true
}
