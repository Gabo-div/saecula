package images

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UpsertAssets writes catalog rows in one transaction. Idempotent: re-running
// the same manifest updates rows in place (ON CONFLICT (id)). Variants are
// stored as JSONB.
func UpsertAssets(ctx context.Context, pool *pgxpool.Pool, assets []Asset) error {
	if len(assets) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, a := range assets {
		variants, err := json.Marshal(a.Variants)
		if err != nil {
			return fmt.Errorf("%s: marshal variants: %w", a.ID, err)
		}
		batch.Queue(`
			INSERT INTO image_assets
			  (id, title, artist, source_url, license, license_url, attribution,
			   variants, is_background, is_share)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
			ON CONFLICT (id) DO UPDATE SET
			  title=EXCLUDED.title, artist=EXCLUDED.artist, source_url=EXCLUDED.source_url,
			  license=EXCLUDED.license, license_url=EXCLUDED.license_url,
			  attribution=EXCLUDED.attribution, variants=EXCLUDED.variants,
			  is_background=EXCLUDED.is_background, is_share=EXCLUDED.is_share`,
			a.ID, a.Title, nilIfEmpty(a.Artist), nilIfEmpty(a.SourceURL),
			a.License, nilIfEmpty(a.LicenseURL), a.Attribution,
			variants, a.IsBackground, a.IsShare)
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	results := tx.SendBatch(ctx, batch)
	for i := 0; i < batch.Len(); i++ {
		if _, err := results.Exec(); err != nil {
			_ = results.Close()
			return fmt.Errorf("upsert asset %d: %w", i, err)
		}
	}
	if err := results.Close(); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func nilIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}
