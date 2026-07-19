package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"github.com/spf13/cobra"

	"saecula/cli/internal/seed"
)

var seedOpts struct {
	files         []string
	postgresDSN   string
	neo4jURI      string
	neo4jUser     string
	neo4jPassword string
}

var seedCmd = &cobra.Command{
	Use:   "seed",
	Short: "Load generic JSON documents into PostgreSQL and Neo4j",
	Long: `Reads generic document files (produced by scrape, or handwritten —
see apps/cli/data/ for the shape), inserts every text segment into
PostgreSQL (text_documents) and merges the matching concept nodes plus
timeline relationships into Neo4j.

Idempotent: texts upsert via ON CONFLICT, nodes and edges via MERGE —
re-running the same file is safe.`,
	Example: `  saecula-cli seed --file data/sample_john_3.json
  saecula-cli seed --file data/jn_3_la.json --file data/ccc_es.json`,
	RunE: runSeed,
}

func runSeed(cmd *cobra.Command, _ []string) error {
	ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Minute)
	defer cancel()

	// --- Infrastructure (owned here, injected below) -----------------------
	pool, err := pgxpool.New(ctx, seedOpts.postgresDSN)
	if err != nil {
		return fmt.Errorf("postgres pool: %w", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("postgres ping: %w", err)
	}

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
	seedCmd.Flags().StringArrayVar(&seedOpts.files, "file", nil, "generic JSON document to seed (repeatable, required)")
	_ = seedCmd.MarkFlagRequired("file")

	// Database flags live on seed only — scrape never touches a database.
	seedCmd.Flags().StringVar(&seedOpts.postgresDSN, "pg-dsn",
		"postgres://saecula:saecula_dev_password@localhost:5432/saecula?sslmode=disable",
		"PostgreSQL connection string")
	seedCmd.Flags().StringVar(&seedOpts.neo4jURI, "neo4j-uri",
		"neo4j://localhost:7687", "Neo4j Bolt URI")
	seedCmd.Flags().StringVar(&seedOpts.neo4jUser, "neo4j-user",
		"neo4j", "Neo4j username")
	seedCmd.Flags().StringVar(&seedOpts.neo4jPassword, "neo4j-password",
		"saecula_dev_password", "Neo4j password")

	rootCmd.AddCommand(seedCmd)
}
