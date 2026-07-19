package auth

import (
	"errors"
	"log/slog"
	"net/http"
	"net/mail"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

	"saecula/back/internal/httpx"
)

// API serves /auth/register and /auth/login. All collaborators are
// injected as interfaces, so storage and token strategy are swappable.
type API struct {
	users  UserRepository
	tokens TokenIssuer
}

func NewAPI(users UserRepository, tokens TokenIssuer) *API {
	return &API{users: users, tokens: tokens}
}

// Pattern is where the server mounts this API.
func (a *API) Pattern() string { return "/auth" }

// Routes mounts the public authentication endpoints.
func (a *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/register", a.Register)
	r.Post("/login", a.Login)
	return r
}

type credentialsRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	User      userDTO   `json:"user"`
}

type userDTO struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func (a *API) Register(w http.ResponseWriter, r *http.Request) {
	var req credentialsRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if _, err := mail.ParseAddress(req.Email); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid email address")
		return
	}
	if len(req.Password) < 8 {
		httpx.WriteError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		slog.Error("bcrypt hash", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}

	user, err := a.users.Create(r.Context(), req.Email, string(hash))
	if errors.Is(err, ErrEmailTaken) {
		httpx.WriteError(w, http.StatusConflict, "email already registered")
		return
	}
	if err != nil {
		slog.Error("create user", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}

	a.respondWithToken(w, user, http.StatusCreated)
}

func (a *API) Login(w http.ResponseWriter, r *http.Request) {
	var req credentialsRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	user, err := a.users.ByEmail(r.Context(), req.Email)
	if errors.Is(err, ErrUserNotFound) {
		// Same response as a bad password: don't leak which emails exist.
		httpx.WriteError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil {
		slog.Error("lookup user", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	a.respondWithToken(w, user, http.StatusOK)
}

func (a *API) respondWithToken(w http.ResponseWriter, user *User, status int) {
	token, expiresAt, err := a.tokens.Issue(user.ID, user.Email)
	if err != nil {
		slog.Error("issue token", "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}
	httpx.WriteJSON(w, status, authResponse{
		Token:     token,
		ExpiresAt: expiresAt,
		User:      userDTO{ID: user.ID, Email: user.Email},
	})
}
