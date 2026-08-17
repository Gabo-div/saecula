package bookmarks

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SavedVerse is one user-saved verse with optional highlight and note.
type SavedVerse struct {
	ID             string  `json:"id"`
	EntityID       string  `json:"entity_id"`
	Reference      string  `json:"reference"`
	VerseText      string  `json:"verse_text"`
	HighlightColor *string `json:"highlight_color,omitempty"`
	Note           *string `json:"note,omitempty"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
}

// Repository defines the data-access contract for user saved verses.
type Repository interface {
	List(ctx context.Context, userID string, filter string) ([]SavedVerse, error)
	Get(ctx context.Context, userID, entityID string) (*SavedVerse, error)
	Upsert(ctx context.Context, userID, entityID, reference, verseText string, highlightColor *string, note *string) (*SavedVerse, error)
	UpdateHighlight(ctx context.Context, userID, entityID string, color *string) error
	UpdateNote(ctx context.Context, userID, entityID string, note *string) error
	Delete(ctx context.Context, userID, entityID string) error
	DeleteByID(ctx context.Context, userID, id string) error
	Count(ctx context.Context, userID string) (int, error)
}

// PostgresRepository is the PostgreSQL implementation of Repository.
type PostgresRepository struct {
	pool *pgxpool.Pool
}

var _ Repository = (*PostgresRepository)(nil)

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (repo *PostgresRepository) List(ctx context.Context, userID string, filter string) ([]SavedVerse, error) {
	sql := `
		SELECT id, entity_id, reference, verse_text, highlight_color, note,
		       created_at, updated_at
		FROM user_saved_verses
		WHERE user_id = $1`
	args := []any{userID}

	switch filter {
	case "highlighted":
		sql += ` AND highlight_color IS NOT NULL`
	case "notes":
		sql += ` AND note IS NOT NULL AND note != ''`
	}

	sql += ` ORDER BY created_at DESC`

	rows, err := repo.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var verses []SavedVerse
	for rows.Next() {
		var v SavedVerse
		if err := rows.Scan(&v.ID, &v.EntityID, &v.Reference, &v.VerseText,
			&v.HighlightColor, &v.Note, &v.CreatedAt, &v.UpdatedAt); err != nil {
			return nil, err
		}
		verses = append(verses, v)
	}
	return verses, rows.Err()
}

func (repo *PostgresRepository) Get(ctx context.Context, userID, entityID string) (*SavedVerse, error) {
	var v SavedVerse
	err := repo.pool.QueryRow(ctx,
		`SELECT id, entity_id, reference, verse_text, highlight_color, note,
		        created_at, updated_at
		 FROM user_saved_verses
		 WHERE user_id = $1 AND entity_id = $2`, userID, entityID).
		Scan(&v.ID, &v.EntityID, &v.Reference, &v.VerseText,
			&v.HighlightColor, &v.Note, &v.CreatedAt, &v.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (repo *PostgresRepository) Upsert(ctx context.Context, userID, entityID, reference, verseText string, highlightColor *string, note *string) (*SavedVerse, error) {
	var v SavedVerse
	err := repo.pool.QueryRow(ctx,
		`INSERT INTO user_saved_verses (user_id, entity_id, reference, verse_text, highlight_color, note)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (user_id, entity_id) DO UPDATE SET
		     highlight_color = COALESCE(EXCLUDED.highlight_color, user_saved_verses.highlight_color),
		     note            = COALESCE(EXCLUDED.note, user_saved_verses.note),
		     verse_text      = EXCLUDED.verse_text,
		     reference       = EXCLUDED.reference,
		     updated_at      = now()
		 RETURNING id, entity_id, reference, verse_text, highlight_color, note,
		           created_at, updated_at`,
		userID, entityID, reference, verseText, highlightColor, note).
		Scan(&v.ID, &v.EntityID, &v.Reference, &v.VerseText,
			&v.HighlightColor, &v.Note, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (repo *PostgresRepository) UpdateHighlight(ctx context.Context, userID, entityID string, color *string) error {
	_, err := repo.pool.Exec(ctx,
		`UPDATE user_saved_verses
		 SET highlight_color = $3, updated_at = now()
		 WHERE user_id = $1 AND entity_id = $2`, userID, entityID, color)
	return err
}

func (repo *PostgresRepository) UpdateNote(ctx context.Context, userID, entityID string, note *string) error {
	_, err := repo.pool.Exec(ctx,
		`UPDATE user_saved_verses
		 SET note = $3, updated_at = now()
		 WHERE user_id = $1 AND entity_id = $2`, userID, entityID, note)
	return err
}

func (repo *PostgresRepository) Delete(ctx context.Context, userID, entityID string) error {
	_, err := repo.pool.Exec(ctx,
		`DELETE FROM user_saved_verses WHERE user_id = $1 AND entity_id = $2`,
		userID, entityID)
	return err
}

func (repo *PostgresRepository) DeleteByID(ctx context.Context, userID, id string) error {
	_, err := repo.pool.Exec(ctx,
		`DELETE FROM user_saved_verses WHERE user_id = $1 AND id = $2`,
		userID, id)
	return err
}

func (repo *PostgresRepository) Count(ctx context.Context, userID string) (int, error) {
	var count int
	err := repo.pool.QueryRow(ctx,
		`SELECT count(*) FROM user_saved_verses WHERE user_id = $1`, userID).Scan(&count)
	return count, err
}
