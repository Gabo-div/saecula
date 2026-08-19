package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"saecula/db/gen"
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
	q *gen.Queries
}

// Compile-time check that the implementation satisfies the interface.
var _ UserRepository = (*PostgresUserRepository)(nil)

func NewPostgresUserRepository(pool *pgxpool.Pool) *PostgresUserRepository {
	return &PostgresUserRepository{q: gen.New(pool)}
}

func (r *PostgresUserRepository) Create(ctx context.Context, email, passwordHash string) (*User, error) {
	id, err := r.q.CreateUser(ctx, gen.CreateUserParams{Email: email, PasswordHash: passwordHash})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == uniqueViolationCode {
			return nil, ErrEmailTaken
		}
		return nil, fmt.Errorf("insert user: %w", err)
	}
	return &User{ID: id, Email: email, PasswordHash: passwordHash}, nil
}

func (r *PostgresUserRepository) ByEmail(ctx context.Context, email string) (*User, error) {
	row, err := r.q.GetUserByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("select user: %w", err)
	}
	return &User{ID: row.ID, Email: email, PasswordHash: row.PasswordHash}, nil
}
