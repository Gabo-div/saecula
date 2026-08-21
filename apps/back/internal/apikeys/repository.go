package apikeys

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"saecula/db/gen"
)

// ErrNotFound covers both an unknown key and a revoked one — callers must not
// be able to tell those apart from the outside.
var ErrNotFound = errors.New("api key not found")

// Key is the authenticated caller behind a request to the public MCP endpoint.
type Key struct {
	ID     string
	UserID string
}

// Summary is a key as its owner sees it: never the secret, plus the usage
// totals that answer "is this key still in use?" before revoking it.
type Summary struct {
	ID          string
	Prefix      string
	Name        string
	CreatedAt   time.Time
	TotalCalls  int64
	TotalErrors int64
}

// UsageRow is one (key, day, tool) bucket of the pre-aggregated usage table.
type UsageRow struct {
	KeyID  string
	Prefix string
	Day    time.Time
	Tool   string
	Calls  int32
	Errors int32
}

// Repository abstracts key storage so the middleware and handlers never touch
// a concrete database.
type Repository interface {
	// ByHash returns ErrNotFound when no live key has that hash.
	ByHash(ctx context.Context, hash string) (Key, error)
	Create(ctx context.Context, userID, hash, prefix, name string) (Summary, error)
	List(ctx context.Context, userID string) ([]Summary, error)
	// Revoke returns ErrNotFound when the key is not the user's, or already revoked.
	Revoke(ctx context.Context, id, userID string) error
	RecordUsage(ctx context.Context, keyID, tool string, failed bool) error
	Usage(ctx context.Context, userID string, since time.Time) ([]UsageRow, error)
}

// PostgresRepository is the pgx-backed Repository.
type PostgresRepository struct {
	q *gen.Queries
}

var _ Repository = (*PostgresRepository)(nil)

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{q: gen.New(pool)}
}

func (r *PostgresRepository) ByHash(ctx context.Context, hash string) (Key, error) {
	row, err := r.q.GetAPIKeyByHash(ctx, hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return Key{}, ErrNotFound
	}
	if err != nil {
		return Key{}, fmt.Errorf("select api key: %w", err)
	}
	return Key{ID: row.ID, UserID: row.UserID}, nil
}

func (r *PostgresRepository) Create(ctx context.Context, userID, hash, prefix, name string) (Summary, error) {
	row, err := r.q.CreateAPIKey(ctx, gen.CreateAPIKeyParams{
		UserID: userID, KeyHash: hash, Prefix: prefix, Name: name,
	})
	if err != nil {
		return Summary{}, fmt.Errorf("insert api key: %w", err)
	}
	return Summary{
		ID:        row.ID,
		Prefix:    row.Prefix,
		Name:      row.Name,
		CreatedAt: row.CreatedAt.Time,
	}, nil
}

func (r *PostgresRepository) List(ctx context.Context, userID string) ([]Summary, error) {
	rows, err := r.q.ListAPIKeys(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list api keys: %w", err)
	}
	out := make([]Summary, 0, len(rows))
	for _, row := range rows {
		out = append(out, Summary{
			ID:          row.ID,
			Prefix:      row.Prefix,
			Name:        row.Name,
			CreatedAt:   row.CreatedAt.Time,
			TotalCalls:  row.TotalCalls,
			TotalErrors: row.TotalErrors,
		})
	}
	return out, nil
}

func (r *PostgresRepository) Revoke(ctx context.Context, id, userID string) error {
	n, err := r.q.RevokeAPIKey(ctx, gen.RevokeAPIKeyParams{ID: id, UserID: userID})
	if err != nil {
		return fmt.Errorf("revoke api key: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *PostgresRepository) RecordUsage(ctx context.Context, keyID, tool string, failed bool) error {
	var errCount int32
	if failed {
		errCount = 1
	}
	if err := r.q.RecordAPIKeyUsage(ctx, gen.RecordAPIKeyUsageParams{
		KeyID: keyID, Tool: tool, Errors: errCount,
	}); err != nil {
		return fmt.Errorf("record api key usage: %w", err)
	}
	return nil
}

func (r *PostgresRepository) Usage(ctx context.Context, userID string, since time.Time) ([]UsageRow, error) {
	rows, err := r.q.ListAPIKeyUsage(ctx, gen.ListAPIKeyUsageParams{UserID: userID, Day: since})
	if err != nil {
		return nil, fmt.Errorf("list api key usage: %w", err)
	}
	out := make([]UsageRow, 0, len(rows))
	for _, row := range rows {
		out = append(out, UsageRow{
			KeyID:  row.KeyID,
			Prefix: row.Prefix,
			Day:    row.Day,
			Tool:   row.Tool,
			Calls:  row.Calls,
			Errors: row.Errors,
		})
	}
	return out, nil
}
