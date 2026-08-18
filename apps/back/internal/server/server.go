package server

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"saecula/back/internal/httpx"
)

// API is the contract every feature module implements to be mounted on the
// server. Adding a new API to the backend = implement this interface and
// pass it to New — no router code changes.
type API interface {
	// Pattern is the mount point, e.g. "/timeline".
	Pattern() string
	// Routes returns the module's sub-router.
	Routes() chi.Router
}

// Config wires the server from injected dependencies.
type Config struct {
	Addr string
	// AuthMiddleware guards everything mounted under /api.
	AuthMiddleware func(http.Handler) http.Handler
	// PublicAPIs mount at their own pattern with no auth (e.g. /auth).
	PublicAPIs []API
	// ProtectedAPIs mount under /api behind AuthMiddleware
	// (e.g. Pattern "/timeline" serves at /api/timeline).
	ProtectedAPIs []API
}

// Server owns the HTTP lifecycle. Handlers and middleware arrive fully
// constructed — the server never builds its own dependencies.
type Server struct {
	http *http.Server
}

func New(cfg Config) *Server {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(conditionalTimeout(30 * time.Second))
	r.Use(corsMiddleware)

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	for _, api := range cfg.PublicAPIs {
		r.Mount(api.Pattern(), api.Routes())
	}

	r.Route("/api", func(r chi.Router) {
		if cfg.AuthMiddleware != nil {
			r.Use(cfg.AuthMiddleware)
		}
		for _, api := range cfg.ProtectedAPIs {
			r.Mount(api.Pattern(), api.Routes())
		}
	})

	return &Server{
		http: &http.Server{
			Addr:              cfg.Addr,
			Handler:           r,
			ReadHeaderTimeout: 10 * time.Second,
		},
	}
}

// conditionalTimeout applies a request timeout to every route except the
// streaming chat endpoint. middleware.Timeout cancels the request context and
// wraps the ResponseWriter in a non-flushing buffer, both of which break a
// long-lived Server-Sent Events response (and abort the upstream LLM call).
func conditionalTimeout(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		timed := middleware.Timeout(d)(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPost && (r.URL.Path == "/api/chat" || r.URL.Path == "/api/chat/") {
				next.ServeHTTP(w, r)
				return
			}
			timed.ServeHTTP(w, r)
		})
	}
}

// corsMiddleware reflects any Origin so browser clients (Expo web, local
// tools) can call the API. Authentication is Bearer-token based — no
// cookies — so a permissive CORS policy does not enable CSRF.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Max-Age", "86400")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Handler exposes the routed http.Handler so tests (and any embedder) can
// serve it directly via httptest without binding a port.
func (s *Server) Handler() http.Handler { return s.http.Handler }

// Run blocks until ctx is cancelled or the listener fails, then drains
// in-flight requests gracefully.
func (s *Server) Run(ctx context.Context) error {
	serverErr := make(chan error, 1)
	go func() {
		slog.Info("http server listening", "addr", s.http.Addr)
		if err := s.http.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	select {
	case err := <-serverErr:
		return err
	case <-ctx.Done():
		slog.Info("shutdown signal received, draining connections")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := s.http.Shutdown(shutdownCtx); err != nil {
		return err
	}
	slog.Info("server stopped cleanly")
	return nil
}
