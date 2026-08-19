package bookmarks

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"saecula/db/gen"
)

// SavedVerse is one user-saved verse with optional highlight and note.
type SavedVerse struct {
	ID             string    `json:"id"`
	EntityID       string    `json:"entity_id"`
	Reference      string    `json:"reference"`
	VerseText      string    `json:"verse_text"`
	HighlightColor *string   `json:"highlight_color,omitempty"`
	Note           *string   `json:"note,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
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
	q *gen.Queries
}

var _ Repository = (*PostgresRepository)(nil)

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{q: gen.New(pool)}
}

func toSavedVerse(v gen.UserSavedVerse) SavedVerse {
	return SavedVerse{
		ID:             v.ID,
		EntityID:       v.EntityID,
		Reference:      v.Reference,
		VerseText:      v.VerseText,
		HighlightColor: v.HighlightColor,
		Note:           v.Note,
		CreatedAt:      v.CreatedAt,
		UpdatedAt:      v.UpdatedAt,
	}
}

func (repo *PostgresRepository) List(ctx context.Context, userID string, filter string) ([]SavedVerse, error) {
	var (
		rows []gen.UserSavedVerse
		err  error
	)
	switch filter {
	case "highlighted":
		rows, err = repo.q.ListSavedVersesHighlighted(ctx, userID)
	case "notes":
		rows, err = repo.q.ListSavedVersesWithNotes(ctx, userID)
	default:
		rows, err = repo.q.ListSavedVerses(ctx, userID)
	}
	if err != nil {
		return nil, err
	}
	out := make([]SavedVerse, len(rows))
	for i, r := range rows {
		out[i] = toSavedVerse(r)
	}
	return out, nil
}

func (repo *PostgresRepository) Get(ctx context.Context, userID, entityID string) (*SavedVerse, error) {
	v, err := repo.q.GetSavedVerse(ctx, gen.GetSavedVerseParams{UserID: userID, EntityID: entityID})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	sv := toSavedVerse(v)
	return &sv, nil
}

func (repo *PostgresRepository) Upsert(ctx context.Context, userID, entityID, reference, verseText string, highlightColor *string, note *string) (*SavedVerse, error) {
	v, err := repo.q.UpsertSavedVerse(ctx, gen.UpsertSavedVerseParams{
		UserID:         userID,
		EntityID:       entityID,
		Reference:      reference,
		VerseText:      verseText,
		HighlightColor: highlightColor,
		Note:           note,
	})
	if err != nil {
		return nil, err
	}
	sv := toSavedVerse(v)
	return &sv, nil
}

func (repo *PostgresRepository) UpdateHighlight(ctx context.Context, userID, entityID string, color *string) error {
	return repo.q.UpdateSavedVerseHighlight(ctx, gen.UpdateSavedVerseHighlightParams{
		UserID:         userID,
		EntityID:       entityID,
		HighlightColor: color,
	})
}

func (repo *PostgresRepository) UpdateNote(ctx context.Context, userID, entityID string, note *string) error {
	return repo.q.UpdateSavedVerseNote(ctx, gen.UpdateSavedVerseNoteParams{
		UserID:   userID,
		EntityID: entityID,
		Note:     note,
	})
}

func (repo *PostgresRepository) Delete(ctx context.Context, userID, entityID string) error {
	return repo.q.DeleteSavedVerse(ctx, gen.DeleteSavedVerseParams{UserID: userID, EntityID: entityID})
}

func (repo *PostgresRepository) DeleteByID(ctx context.Context, userID, id string) error {
	return repo.q.DeleteSavedVerseByID(ctx, gen.DeleteSavedVerseByIDParams{UserID: userID, ID: id})
}

func (repo *PostgresRepository) Count(ctx context.Context, userID string) (int, error) {
	n, err := repo.q.CountSavedVerses(ctx, userID)
	return int(n), err
}
