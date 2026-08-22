package images

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"

	"saecula/db/gen"
)

type PostgresRepository struct {
	q         *gen.Queries
	imageBase string
}

var _ BackgroundRepository = (*PostgresRepository)(nil)

func NewPostgresRepository(pool *pgxpool.Pool, imageBase string) *PostgresRepository {
	return &PostgresRepository{q: gen.New(pool), imageBase: imageBase}
}

// Backgrounds returns every is_background asset as its 1200w URL + attribution.
// variants store relative keys; the public base is prepended here so the domain
// lives in config, not the DB. Assets missing a 1200 variant are skipped.
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
		key := variants["1200"]
		if key == "" {
			continue
		}
		out = append(out, Background{URL: r.imageBase + "/" + key, Attribution: row.Attribution})
	}
	return out, nil
}
