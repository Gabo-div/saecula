package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"saecula/back/internal/httpx"
)

type contextKey string

const (
	ctxKeyUserID contextKey = "saecula.user_id"
	ctxKeyEmail  contextKey = "saecula.email"
)

// Claims is the JWT payload issued at login/registration.
type Claims struct {
	Email string `json:"email"`
	jwt.RegisteredClaims
}

// TokenIssuer creates session tokens. Depend on this (not the concrete
// TokenManager) wherever tokens are only produced.
type TokenIssuer interface {
	Issue(userID, email string) (token string, expiresAt time.Time, err error)
}

// TokenValidator verifies session tokens. The auth middleware depends on
// this interface only.
type TokenValidator interface {
	Validate(tokenString string) (*Claims, error)
}

// TokenService combines both sides for components that need the full
// lifecycle.
type TokenService interface {
	TokenIssuer
	TokenValidator
}

// TokenManager is the HS256 implementation of TokenService.
type TokenManager struct {
	secret     []byte
	expiration time.Duration
}

var _ TokenService = (*TokenManager)(nil)

func NewTokenManager(secret []byte, expiration time.Duration) *TokenManager {
	return &TokenManager{secret: secret, expiration: expiration}
}

func (tm *TokenManager) Issue(userID, email string) (string, time.Time, error) {
	expiresAt := time.Now().Add(tm.expiration)
	claims := Claims{
		Email: email,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			Issuer:    "saecula-api",
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(tm.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign token: %w", err)
	}
	return signed, expiresAt, nil
}

func (tm *TokenManager) Validate(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims,
		func(t *jwt.Token) (any, error) { return tm.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer("saecula-api"),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

// Middleware returns a chi/net-http middleware that rejects requests
// without a valid Bearer token and injects the authenticated user's ID and
// email into the request context. It only needs a TokenValidator, so tests
// can inject a stub.
func Middleware(validator TokenValidator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" {
				httpx.WriteError(w, http.StatusUnauthorized, "missing Authorization header")
				return
			}
			parts := strings.SplitN(header, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				httpx.WriteError(w, http.StatusUnauthorized, "Authorization header must be 'Bearer <token>'")
				return
			}

			claims, err := validator.Validate(parts[1])
			if err != nil {
				httpx.WriteError(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}

			ctx := context.WithValue(r.Context(), ctxKeyUserID, claims.Subject)
			ctx = context.WithValue(ctx, ctxKeyEmail, claims.Email)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserIDFromContext returns the authenticated user's ID set by Middleware.
func UserIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(ctxKeyUserID).(string)
	return id, ok
}
