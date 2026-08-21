package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/spf13/cobra"

	"saecula/cli/internal/images"
)

var imagesSeedOpts struct {
	file        string
	postgresDSN string
}

var imagesCmd = &cobra.Command{
	Use:   "images",
	Short: "Curate art into Cloudflare R2 and its Postgres catalog",
}

var imagesSeedCmd = &cobra.Command{
	Use:   "seed",
	Short: "Upsert image_assets rows from the manifest (no R2 credentials needed)",
	Long: `Loads apps/cli/data/images.json into the image_assets catalog. Only
metadata and the already-published R2 URLs are written — no binaries, no R2
access. This is what local dev runs to reproduce the catalog.`,
	Example: `  saecula-cli images seed --file data/images.json`,
	RunE:    runImagesSeed,
}

func runImagesSeed(cmd *cobra.Command, _ []string) error {
	ctx, cancel := context.WithTimeout(cmd.Context(), time.Minute)
	defer cancel()

	assets, err := images.LoadManifest(imagesSeedOpts.file)
	if err != nil {
		return err
	}
	pool, err := pgxpool.New(ctx, imagesSeedOpts.postgresDSN)
	if err != nil {
		return fmt.Errorf("postgres pool: %w", err)
	}
	defer pool.Close()
	if err := images.UpsertAssets(ctx, pool, assets); err != nil {
		return err
	}
	fmt.Printf("%s: %d image assets upserted\n", imagesSeedOpts.file, len(assets))
	return nil
}

func init() {
	imagesSeedCmd.Flags().StringVar(&imagesSeedOpts.file, "file", "data/images.json", "image manifest JSON")
	imagesSeedCmd.Flags().StringVar(&imagesSeedOpts.postgresDSN, "pg-dsn",
		"postgres://saecula:saecula_dev_password@localhost:5432/saecula?sslmode=disable",
		"PostgreSQL connection string")
	imagesCmd.AddCommand(imagesSeedCmd)
	rootCmd.AddCommand(imagesCmd)
}
