package mcptools

import (
	"context"
	"os"
	"testing"

	"github.com/firebase/genkit/go/ai"
	"github.com/jackc/pgx/v5/pgxpool"

	"saecula/back/internal/bible"
)

func depsOrSkip(t *testing.T) (Deps, func()) {
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
	return Deps{Scripture: bible.NewPostgresTextRepository(pool), Pool: pool}, pool.Close
}

func tc() *ai.ToolContext { return &ai.ToolContext{Context: context.Background()} }

func TestGetCatechism(t *testing.T) {
	d, done := depsOrSkip(t)
	defer done()

	out, err := d.getCatechism(tc(), getCatechismIn{From: 1, To: 3, Lang: "en"})
	if err != nil {
		t.Fatalf("getCatechism: %v", err)
	}
	if len(out) != 3 || out[0].Number != 1 || out[0].Text == "" {
		t.Fatalf("getCatechism(1..3) = %+v, want paragraphs 1,2,3 with text", out)
	}
}

func TestSearchCatechism(t *testing.T) {
	d, done := depsOrSkip(t)
	defer done()

	out, err := d.searchCatechism(tc(), searchCatechismIn{Query: "grace", Lang: "en"})
	if err != nil {
		t.Fatalf("searchCatechism: %v", err)
	}
	if len(out) == 0 || out[0].Snippet == "" {
		t.Fatalf("searchCatechism(grace) returned no usable hits: %+v", out)
	}
}

func TestSearchScripture(t *testing.T) {
	d, done := depsOrSkip(t)
	defer done()

	// The seeded Bible is the Spanish CEE edition, so query in Spanish.
	out, err := d.searchScripture(tc(), searchScriptureIn{Query: "amor"})
	if err != nil {
		t.Fatalf("searchScripture: %v", err)
	}
	if len(out) == 0 || out[0].EntityID == "" || out[0].Text == "" {
		t.Fatalf("searchScripture(amor) returned no usable hits: %+v", out)
	}
}
