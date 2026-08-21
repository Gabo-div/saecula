package images

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"

	"saecula/db/gen"
)

type PostgresRepository struct {
	q *gen.Queries
}

var _ BackgroundRepository = (*PostgresRepository)(nil)

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{q: gen.New(pool)}
}

// Backgrounds returns every is_background asset as its 1200w URL + attribution.
// Assets missing a 1200 variant are skipped rather than served broken.
func (r *PostgresRepository) Backgrounds(ctx context.Context) ([]Background, error) {
	rows, err := r.q.BackgroundImages(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Background, 0, len(rows))
	for _, row := range rows {
		var variants map[string]string
		if err := json.Unmarshal(row.Variants, &variants); err != nil {
			continue
		}
		url := variants["1200"]
		if url == "" {
			continue
		}
		out = append(out, Background{URL: url, Attribution: row.Attribution})
	}
	return out, nil
}
