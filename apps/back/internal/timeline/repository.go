package timeline

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"

	"saecula/db/gen"
)

// Node is one timeline entry: language-agnostic structure from the graph,
// optionally enriched with a localized text payload.
type Node struct {
	ID        string         `json:"id"`
	Labels    []string       `json:"labels"`
	StartYear int64          `json:"start_year"`
	EndYear   *int64         `json:"end_year,omitempty"`
	Era       string         `json:"era,omitempty"`
	Props     map[string]any `json:"props"`
	Text      *LocalizedText `json:"text,omitempty"`
}

// LocalizedText is the PostgreSQL payload attached to a concept node.
type LocalizedText struct {
	LanguageCode  string          `json:"language_code"`
	TranslationID string          `json:"translation_id"`
	RawContent    string          `json:"raw_content"`
	Metadata      json.RawMessage `json:"metadata,omitempty"`
}

// GraphRepository abstracts the concept graph. Implementations return
// nodes whose lifespan overlaps [startYear, endYear], chronologically
// ordered, without text payloads.
type GraphRepository interface {
	NodesInRange(ctx context.Context, startYear, endYear int64) ([]Node, error)
}

// TextRepository abstracts the localized translation store. It returns one
// LocalizedText per entity ID (when available) for the requested language;
// translationID pins a specific edition, empty picks a default.
type TextRepository interface {
	TextsFor(ctx context.Context, entityIDs []string, lang, translationID string) (map[string]*LocalizedText, error)
}

// ---------------------------------------------------------------------------
// Neo4j implementation of GraphRepository
// ---------------------------------------------------------------------------

type Neo4jGraphRepository struct {
	driver neo4j.DriverWithContext
}

var _ GraphRepository = (*Neo4jGraphRepository)(nil)

func NewNeo4jGraphRepository(driver neo4j.DriverWithContext) *Neo4jGraphRepository {
	return &Neo4jGraphRepository{driver: driver}
}

func (repo *Neo4jGraphRepository) NodesInRange(ctx context.Context, startYear, endYear int64) ([]Node, error) {
	const cypher = `
		MATCH (n)
		WHERE n.start_year IS NOT NULL
		  AND n.start_year <= $end_year
		  AND coalesce(n.end_year, n.start_year) >= $start_year
		RETURN n.id        AS id,
		       labels(n)   AS labels,
		       n.start_year AS start_year,
		       n.end_year   AS end_year,
		       n.era        AS era,
		       properties(n) AS props
		ORDER BY n.start_year ASC, id ASC`

	result, err := neo4j.ExecuteQuery(ctx, repo.driver, cypher,
		map[string]any{"start_year": startYear, "end_year": endYear},
		neo4j.EagerResultTransformer,
		neo4j.ExecuteQueryWithReadersRouting(),
	)
	if err != nil {
		return nil, err
	}

	nodes := make([]Node, 0, len(result.Records))
	for _, record := range result.Records {
		node := Node{Props: map[string]any{}}

		if id, ok := record.Get("id"); ok {
			node.ID, _ = id.(string)
		}
		if node.ID == "" {
			continue // nodes without a universal slug cannot be localized
		}
		if rawLabels, ok := record.Get("labels"); ok {
			if labelList, ok := rawLabels.([]any); ok {
				for _, l := range labelList {
					if s, ok := l.(string); ok {
						node.Labels = append(node.Labels, s)
					}
				}
			}
		}
		if v, ok := record.Get("start_year"); ok {
			if y, ok := v.(int64); ok {
				node.StartYear = y
			}
		}
		if v, ok := record.Get("end_year"); ok {
			if y, ok := v.(int64); ok {
				node.EndYear = &y
			}
		}
		if v, ok := record.Get("era"); ok {
			node.Era, _ = v.(string)
		}
		if v, ok := record.Get("props"); ok {
			if props, ok := v.(map[string]any); ok {
				node.Props = props
			}
		}
		nodes = append(nodes, node)
	}
	return nodes, nil
}

// ---------------------------------------------------------------------------
// PostgreSQL implementation of TextRepository
// ---------------------------------------------------------------------------

type PostgresTextRepository struct {
	q *gen.Queries
}

var _ TextRepository = (*PostgresTextRepository)(nil)

func NewPostgresTextRepository(pool *pgxpool.Pool) *PostgresTextRepository {
	return &PostgresTextRepository{q: gen.New(pool)}
}

func (repo *PostgresTextRepository) TextsFor(ctx context.Context, entityIDs []string, lang, translationID string) (map[string]*LocalizedText, error) {
	if len(entityIDs) == 0 {
		return map[string]*LocalizedText{}, nil
	}
	// A pinned translation overrides lang (an edition fixes its own language);
	// otherwise DISTINCT ON keeps one edition per entity in the requested lang.
	rows, err := repo.q.TimelineTexts(ctx, gen.TimelineTextsParams{
		EntityIds:     entityIDs,
		TranslationID: translationID,
		Lang:          lang,
	})
	if err != nil {
		return nil, err
	}
	texts := make(map[string]*LocalizedText, len(rows))
	for _, r := range rows {
		texts[r.EntityID] = &LocalizedText{
			LanguageCode:  r.LanguageCode,
			TranslationID: r.TranslationID,
			RawContent:    r.RawContent,
			Metadata:      r.Metadata,
		}
	}
	return texts, nil
}
