package cmd

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"github.com/spf13/cobra"

	"saecula/apikey"
	"saecula/cli/internal/seed"
)

var seedOpts struct {
	files         []string
	testUser      bool
	postgresDSN   string
	neo4jURI      string
	neo4jUser     string
	neo4jPassword string
}

// Dev login seeded by --test-user: test@saecula.app / saecula123
// (bcrypt hash, cost 10). Dev only.
const (
	testUserEmail = "test@saecula.app"
	testUserHash  = "$2a$10$S4adxo1h8ME7JvrWSSIEbOmdA6yyAKoDV8xdVAGs.mtFx5GXYs2ki"
	// devMCPKey is the API key in the repo's .mcp.json, so an agent can call
	// the local MCP endpoint straight after seeding. Like the password above it
	// is worthless off a hand-seeded dev database, and --test-user refuses to
	// run at all under APP_ENV=production.
	devMCPKey     = "sk_saecula_dev_local_only"
	devMCPKeyName = "dev .mcp.json"
)

var seedCmd = &cobra.Command{
	Use:   "seed",
	Short: "Load generic JSON documents into PostgreSQL and Neo4j",
	Long: `Reads generic document files (produced by scrape, or handwritten —
see apps/cli/data/ for the shape), inserts every text segment into
PostgreSQL (text_documents) and merges the matching concept nodes plus
timeline relationships into Neo4j.

Idempotent: texts upsert via ON CONFLICT, nodes and edges via MERGE —
re-running the same file is safe.`,
	Example: `  saecula-cli seed --file data/bible_cee.json --test-user
  saecula-cli seed --test-user
  saecula-cli seed --file data/jn_3_la.json --file data/ccc_es.json`,
	RunE: runSeed,
}

func runSeed(cmd *cobra.Command, _ []string) error {
	ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Minute)
	defer cancel()

	if len(seedOpts.files) == 0 && !seedOpts.testUser {
		return fmt.Errorf("nothing to do: pass --file and/or --test-user")
	}

	// Postgres is needed for both the test user and text documents.
	pool, err := pgxpool.New(ctx, seedOpts.postgresDSN)
	if err != nil {
		return fmt.Errorf("postgres pool: %w", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("postgres ping: %w", err)
	}

	if seedOpts.testUser {
		// Both credentials below are published in the repo, so neither may ever
		// reach a real deployment.
		if os.Getenv("APP_ENV") == "production" {
			return fmt.Errorf("refusing to seed dev credentials with APP_ENV=production")
		}
		if _, err := pool.Exec(ctx,
			`INSERT INTO users (email, password_hash) VALUES ($1, $2)
			 ON CONFLICT (email) DO NOTHING`,
			testUserEmail, testUserHash); err != nil {
			return fmt.Errorf("seed test user: %w", err)
		}
		fmt.Printf("test user ready: %s / saecula123\n", testUserEmail)

		if _, err := pool.Exec(ctx,
			`INSERT INTO api_keys (user_id, key_hash, prefix, name)
			 SELECT id, $1, $2, $3 FROM users WHERE email = $4
			 ON CONFLICT (key_hash) DO NOTHING`,
			apikey.Hash(devMCPKey), apikey.Public(devMCPKey), devMCPKeyName,
			testUserEmail); err != nil {
			return fmt.Errorf("seed dev MCP key: %w", err)
		}
		fmt.Printf("dev MCP key ready: %s (used by .mcp.json)\n", devMCPKey)
	}

	if len(seedOpts.files) == 0 {
		return nil
	}

	// Neo4j only when there are documents to seed.
	driver, err := neo4j.NewDriverWithContext(seedOpts.neo4jURI,
		neo4j.BasicAuth(seedOpts.neo4jUser, seedOpts.neo4jPassword, ""))
	if err != nil {
		return fmt.Errorf("neo4j driver: %w", err)
	}
	defer func() { _ = driver.Close(context.Background()) }()
	if err := driver.VerifyConnectivity(ctx); err != nil {
		return fmt.Errorf("neo4j connectivity: %w", err)
	}

	// --- Composition: inject concrete stores into the seeder ---------------
	seeder := seed.New(
		seed.NewPostgresTextStore(pool),
		seed.NewNeo4jGraphStore(driver),
	)

	for _, file := range seedOpts.files {
		report, err := seeder.SeedFile(ctx, file)
		if err != nil {
			return fmt.Errorf("%s: %w", file, err)
		}
		fmt.Printf("%s: %d texts upserted, %d nodes and %d relationships merged\n",
			file, report.TextsUpserted, report.NodesMerged, report.RelationshipsMerged)
	}
	return nil
}

func init() {
	seedCmd.Flags().StringArrayVar(&seedOpts.files, "file", nil, "generic JSON document to seed (repeatable)")
	seedCmd.Flags().BoolVar(&seedOpts.testUser, "test-user", false,
		"seed the dev login test@saecula.app / saecula123 (Postgres only)")

	// Database flags live on seed only — scrape never touches a database.
	seedCmd.Flags().StringVar(&seedOpts.postgresDSN, "pg-dsn",
		"postgres://saecula:saecula_dev_password@localhost:5432/saecula?sslmode=disable",
		"PostgreSQL connection string")
	seedCmd.Flags().StringVar(&seedOpts.neo4jURI, "neo4j-uri",
		"bolt://localhost:7687", "Neo4j Bolt URI")
	seedCmd.Flags().StringVar(&seedOpts.neo4jUser, "neo4j-user",
		"neo4j", "Neo4j username")
	seedCmd.Flags().StringVar(&seedOpts.neo4jPassword, "neo4j-password",
		"saecula_dev_password", "Neo4j password")

	rootCmd.AddCommand(seedCmd)
}
