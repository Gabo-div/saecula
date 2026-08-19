package streak

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

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
	pool *pgxpool.Pool
}

var _ Repository = (*PostgresRepository)(nil)

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (r *PostgresRepository) Upsert(ctx context.Context, userID, day, activityType string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO activity_days (user_id, day, activity_type)
		 VALUES ($1, $2::date, $3)
		 ON CONFLICT (user_id, day) DO NOTHING`,
		userID, day, activityType)
	return err
}

func (r *PostgresRepository) ActiveDays(ctx context.Context, userID string) ([]time.Time, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT day FROM activity_days WHERE user_id = $1 ORDER BY day`,
		userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []time.Time{}
	for rows.Next() {
		var day time.Time
		if err := rows.Scan(&day); err != nil {
			return nil, err
		}
		out = append(out, day)
	}
	return out, rows.Err()
}

func (r *PostgresRepository) History(ctx context.Context, userID, from, to string) ([]HistoryEntry, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT to_char(day, 'YYYY-MM-DD'), activity_type
		 FROM activity_days
		 WHERE user_id = $1 AND day BETWEEN $2::date AND $3::date
		 ORDER BY day`,
		userID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []HistoryEntry{}
	for rows.Next() {
		var e HistoryEntry
		if err := rows.Scan(&e.Day, &e.ActivityType); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
