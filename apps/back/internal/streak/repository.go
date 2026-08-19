package streak

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"saecula/db/gen"
)

const dayLayout = "2006-01-02"

// HistoryEntry is one credited day, for the calendar/heatmap view.
type HistoryEntry struct {
	Day          string `json:"day"` // YYYY-MM-DD
	ActivityType string `json:"activityType"`
}

// Repository persists activity days scoped to their owner.
type Repository interface {
	// Upsert credits a day; duplicate check-ins on the same day are a no-op
	// (the first activity_type of the day is kept).
	Upsert(ctx context.Context, userID, day, activityType string) error
	// ActiveDays returns the user's distinct active days, ascending.
	ActiveDays(ctx context.Context, userID string) ([]time.Time, error)
	// History returns credited days in [from, to] inclusive, ascending.
	History(ctx context.Context, userID, from, to string) ([]HistoryEntry, error)
}

type PostgresRepository struct {
	q *gen.Queries
}

var _ Repository = (*PostgresRepository)(nil)

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{q: gen.New(pool)}
}

func (r *PostgresRepository) Upsert(ctx context.Context, userID, day, activityType string) error {
	d, err := time.Parse(dayLayout, day)
	if err != nil {
		return err
	}
	return r.q.UpsertActivityDay(ctx, gen.UpsertActivityDayParams{
		UserID:       userID,
		Day:          d,
		ActivityType: activityType,
	})
}

func (r *PostgresRepository) ActiveDays(ctx context.Context, userID string) ([]time.Time, error) {
	return r.q.ActiveDays(ctx, userID)
}

func (r *PostgresRepository) History(ctx context.Context, userID, from, to string) ([]HistoryEntry, error) {
	f, err := time.Parse(dayLayout, from)
	if err != nil {
		return nil, err
	}
	t, err := time.Parse(dayLayout, to)
	if err != nil {
		return nil, err
	}
	rows, err := r.q.ActivityHistory(ctx, gen.ActivityHistoryParams{UserID: userID, Day: f, Day_2: t})
	if err != nil {
		return nil, err
	}
	out := make([]HistoryEntry, len(rows))
	for i, row := range rows {
		out[i] = HistoryEntry{Day: row.Day, ActivityType: row.ActivityType}
	}
	return out, nil
}
