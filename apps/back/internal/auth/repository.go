package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Domain errors the handler maps to HTTP statuses. Repository
// implementations must translate their driver errors into these.
var (
	ErrEmailTaken   = errors.New("email already registered")
	ErrUserNotFound = errors.New("user not found")
)

// User is the credential record needed by the auth flows.
type User struct {
	ID           string
	Email        string
	PasswordHash string
}

// UserRepository abstracts credential storage so handlers never touch a
// concrete database. Swap the implementation freely in tests.
type UserRepository interface {
	// Create persists a new user and returns it with its generated ID.
	// Returns ErrEmailTaken when the email is already registered.
	Create(ctx context.Context, email, passwordHash string) (*User, error)
	// ByEmail returns ErrUserNotFound when no user has that email.
	ByEmail(ctx context.Context, email string) (*User, error)
}

const uniqueViolationCode = "23505"

// PostgresUserRepository is the pgx-backed UserRepository.
type PostgresUserRepository struct {
	pool *pgxpool.Pool
}

// Compile-time check that the implementation satisfies the interface.
var _ UserRepository = (*PostgresUserRepository)(nil)

func NewPostgresUserRepository(pool *pgxpool.Pool) *PostgresUserRepository {
	return &PostgresUserRepository{pool: pool}
}

func (r *PostgresUserRepository) Create(ctx context.Context, email, passwordHash string) (*User, error) {
	user := &User{Email: email, PasswordHash: passwordHash}
	err := r.pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		email, passwordHash,
	).Scan(&user.ID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == uniqueViolationCode {
			return nil, ErrEmailTaken
		}
		return nil, fmt.Errorf("insert user: %w", err)
	}
	return user, nil
}

func (r *PostgresUserRepository) ByEmail(ctx context.Context, email string) (*User, error) {
	user := &User{Email: email}
	err := r.pool.QueryRow(ctx,
		`SELECT id, password_hash FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.PasswordHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("select user: %w", err)
	}
	return user, nil
}
