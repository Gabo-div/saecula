package chat

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// dbOrSkip connects to the dev Postgres; the test is skipped when it isn't
// reachable so the suite still runs without a database.
func dbOrSkip(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("POSTGRES_DSN")
	if dsn == "" {
		dsn = "postgres://saecula:saecula_dev_password@localhost:5432/saecula?sslmode=disable"
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Skipf("no database: %v", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		t.Skipf("no database: %v", err)
	}
	return pool
}

func newUser(t *testing.T, pool *pgxpool.Pool, label string) string {
	t.Helper()
	var id string
	err := pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id`,
		"chat-test-"+t.Name()+"-"+label+"@example.com").Scan(&id)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1`, id)
	})
	return id
}

func TestConversationOwnershipIsolation(t *testing.T) {
	pool := dbOrSkip(t)
	defer pool.Close()
	repo := NewPostgresRepository(pool)
	ctx := context.Background()

	owner := newUser(t, pool, "owner")
	other := newUser(t, pool, "other")

	conv, err := repo.CreateConversation(ctx, owner, "Test")
	if err != nil {
		t.Fatalf("create conversation: %v", err)
	}
	if _, err := repo.AddMessage(ctx, conv.ID, "user", "hola", nil); err != nil {
		t.Fatalf("add message: %v", err)
	}

	// The owner sees it.
	if _, err := repo.GetConversation(ctx, owner, conv.ID); err != nil {
		t.Fatalf("owner get: %v", err)
	}
	msgs, err := repo.Messages(ctx, owner, conv.ID)
	if err != nil || len(msgs) != 1 {
		t.Fatalf("owner messages: %d %v", len(msgs), err)
	}

	// A different user cannot read it.
	if _, err := repo.GetConversation(ctx, other, conv.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("other get = %v, want ErrNotFound", err)
	}
	if msgs, err := repo.Messages(ctx, other, conv.ID); err != nil || len(msgs) != 0 {
		t.Fatalf("other messages = %d %v, want 0/nil", len(msgs), err)
	}

	// A different user cannot delete it.
	if err := repo.DeleteConversation(ctx, other, conv.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("other delete = %v, want ErrNotFound", err)
	}
	// The owner can.
	if err := repo.DeleteConversation(ctx, owner, conv.ID); err != nil {
		t.Fatalf("owner delete: %v", err)
	}
}
