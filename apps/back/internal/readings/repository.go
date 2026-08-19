// Package readings serves the daily Mass readings seeded as LiturgicalDay
// nodes in Neo4j (see apps/cli daily_readings). A day links to its verses
// through READS_<TYPE> edges; this module reads those edges and joins the
// localized verse text from PostgreSQL.
package readings

import (
	"context"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"

	"saecula/db/gen"
)

// Reading is one Mass reading: its type slug (reading_1, responsorial_psalm,
// gospel, …) and the universal IDs of the verses it cites, in reading order.
type Reading struct {
	Type     string
	VerseIDs []string
}

// Day is a liturgical day with its readings, as stored in the graph.
type Day struct {
	Date       string
	Title      string
	Lectionary string
	Readings   []Reading
}

// VerseText is one localized verse joined from the text store.
type VerseText struct {
	EntityID      string `json:"entity_id"`
	LanguageCode  string `json:"language_code"`
	TranslationID string `json:"translation_id"`
	Text          string `json:"text"`
}

// GraphRepository abstracts the concept graph for liturgical days.
type GraphRepository interface {
	// DayReadings returns the day at date (ISO YYYY-MM-DD), or nil when no
	// LiturgicalDay is seeded for it.
	DayReadings(ctx context.Context, date string) (*Day, error)
}

// TextRepository abstracts the localized translation store.
type TextRepository interface {
	// VerseTexts returns the text of each entity ID present in the store,
	// keyed by entity ID. Missing IDs are simply absent from the map.
	VerseTexts(ctx context.Context, entityIDs []string, lang, translationID string) (map[string]VerseText, error)
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

func (repo *Neo4jGraphRepository) DayReadings(ctx context.Context, date string) (*Day, error) {
	// One row per reading type; verse IDs collected per type. A day with no
	// verse edges yields a single row with rel = null.
	const cypher = `
		MATCH (d:LiturgicalDay {date: $date})
		OPTIONAL MATCH (d)-[r]->(v:Verse)
		RETURN d.title AS title, d.lectionary AS lectionary,
		       type(r) AS rel, collect(v.id) AS verse_ids`

	result, err := neo4j.ExecuteQuery(ctx, repo.driver, cypher,
		map[string]any{"date": date},
		neo4j.EagerResultTransformer,
		neo4j.ExecuteQueryWithReadersRouting(),
	)
	if err != nil {
		return nil, err
	}
	if len(result.Records) == 0 {
		return nil, nil // no such day
	}

	day := &Day{Date: date}
	for _, record := range result.Records {
		if title, ok := record.Get("title"); ok {
			if s, ok := title.(string); ok {
				day.Title = s
			}
		}
		if lec, ok := record.Get("lectionary"); ok {
			if s, ok := lec.(string); ok {
				day.Lectionary = s
			}
		}

		rel, _ := record.Get("rel")
		relStr, ok := rel.(string)
		if !ok {
			continue // day exists but has no verse edges
		}
		raw, _ := record.Get("verse_ids")
		ids := toStringSlice(raw)
		if len(ids) == 0 {
			continue
		}
		day.Readings = append(day.Readings, Reading{
			Type:     relTypeToSlug(relStr),
			VerseIDs: sortVerseIDs(ids),
		})
	}
	return day, nil
}

// relTypeToSlug turns a "READS_RESPONSORIAL_PSALM" edge type into the
// "responsorial_psalm" slug the seeder derived it from.
func relTypeToSlug(relType string) string {
	return strings.ToLower(strings.TrimPrefix(relType, "READS_"))
}

func toStringSlice(v any) []string {
	list, ok := v.([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(list))
	for _, item := range list {
		if s, ok := item.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

// sortVerseIDs orders BOOK.CHAPTER.VERSE ids by (chapter, verse) numerically,
// so "WIS.12.9" precedes "WIS.12.10" (lexical order would not).
func sortVerseIDs(ids []string) []string {
	sort.SliceStable(ids, func(i, j int) bool {
		ca, va := chapterVerse(ids[i])
		cb, vb := chapterVerse(ids[j])
		if ca != cb {
			return ca < cb
		}
		return va < vb
	})
	return ids
}

func chapterVerse(entityID string) (chapter, verse int) {
	parts := strings.Split(entityID, ".")
	if len(parts) != 3 {
		return 0, 0
	}
	chapter, _ = strconv.Atoi(parts[1])
	verse, _ = strconv.Atoi(parts[2])
	return chapter, verse
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

func (repo *PostgresTextRepository) VerseTexts(ctx context.Context, entityIDs []string, lang, translationID string) (map[string]VerseText, error) {
	texts := make(map[string]VerseText, len(entityIDs))
	if len(entityIDs) == 0 {
		return texts, nil
	}
	rows, err := repo.q.ReadingsVerseTexts(ctx, gen.ReadingsVerseTextsParams{
		EntityIds:     entityIDs,
		TranslationID: translationID,
		Lang:          lang,
	})
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		texts[r.EntityID] = VerseText{
			EntityID:      r.EntityID,
			LanguageCode:  r.LanguageCode,
			TranslationID: r.TranslationID,
			Text:          r.RawContent,
		}
	}
	return texts, nil
}
