package seed

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresTextStore is the pgx-backed TextStore. The pool is injected —
// this type never opens its own connections.
type PostgresTextStore struct {
	pool *pgxpool.Pool
}

var _ TextStore = (*PostgresTextStore)(nil)

func NewPostgresTextStore(pool *pgxpool.Pool) *PostgresTextStore {
	return &PostgresTextStore{pool: pool}
}

// Upsert writes all records in one transaction using a pgx batch.
// Idempotent: re-running the same document updates content in place.
func (s *PostgresTextStore) Upsert(ctx context.Context, records []TextRecord) error {
	if len(records) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for _, rec := range records {
		batch.Queue(`
			INSERT INTO text_documents (entity_id, language_code, translation_id, raw_content, metadata)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (entity_id, language_code, translation_id)
			DO UPDATE SET raw_content = EXCLUDED.raw_content, metadata = EXCLUDED.metadata`,
			rec.EntityID, rec.LanguageCode, rec.TranslationID, rec.RawContent, rec.Metadata)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	results := tx.SendBatch(ctx, batch)
	for i := 0; i < batch.Len(); i++ {
		if _, err := results.Exec(); err != nil {
			_ = results.Close()
			return fmt.Errorf("batch statement %d: %w", i, err)
		}
	}
	if err := results.Close(); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
