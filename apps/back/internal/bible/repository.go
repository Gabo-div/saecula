package bible

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// Verse is one localized verse of a chapter.
type Verse struct {
	EntityID      string `json:"entity_id"`
	Number        int    `json:"number"`
	Text          string `json:"text"`
	LanguageCode  string `json:"language_code"`
	TranslationID string `json:"translation_id"`
}

// SearchHit is one full-text match: the verse entity ID and its text.
type SearchHit struct {
	EntityID string
	Text     string
}

// Translation is one Bible edition present in the translation store.
type Translation struct {
	ID           string `json:"id"`
	LanguageCode string `json:"language_code"`
	VerseCount   int64  `json:"verse_count"`
}

// GraphRepository abstracts the concept graph: how many chapters each book
// actually has in the seeded data (chapter counts are source data, not
// canon metadata).
type GraphRepository interface {
	ChapterCounts(ctx context.Context) (map[string]int64, error)
}

// DailyFeature is a curated verse-of-the-day (one verse or a range), an
// optional background image, and optionally one or more Catechism paragraphs
// for a specific date.
type DailyFeature struct {
	VerseIDs         []string
	ImageURL         string
	CatechismNumbers []int
}

// CatechismParagraph is one numbered CCC paragraph's text in a language.
type CatechismParagraph struct {
	Number int    `json:"number"`
	Text   string `json:"text"`
}

// TextRepository abstracts the localized translation store for Bible reads.
type TextRepository interface {
	// ChapterVerses returns every verse of book/chapter in lang, ordered by
	// verse number. Empty translationID picks a default edition per verse.
	ChapterVerses(ctx context.Context, bookCode string, chapter int, lang, translationID string) ([]Verse, error)
	// VerseText returns a single verse by entity ID, or nil when absent.
	VerseText(ctx context.Context, entityID, lang, translationID string) (*Verse, error)
	// Translations lists every (translation, language) edition available.
	Translations(ctx context.Context) ([]Translation, error)
	// DailyFeature returns the curated feature for a date (YYYY-MM-DD), or
	// nil when none is set (caller falls back to the built-in rotation).
	DailyFeature(ctx context.Context, date string) (*DailyFeature, error)
	// CatechismParagraphs returns the text of the given CCC paragraph numbers
	// in lang, in the requested order; numbers without a translation are
	// skipped.
	CatechismParagraphs(ctx context.Context, numbers []int, lang string) ([]CatechismParagraph, error)
	// SearchVerses full-text searches verse text, ranked by relevance. Empty
	// translationID searches every edition.
	SearchVerses(ctx context.Context, query, translationID string, limit int) ([]SearchHit, error)
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

func (repo *Neo4jGraphRepository) ChapterCounts(ctx context.Context) (map[string]int64, error) {
	const cypher = `
		MATCH (v:Verse)
		RETURN v.book AS code, max(v.chapter) AS chapters`

	result, err := neo4j.ExecuteQuery(ctx, repo.driver, cypher, nil,
		neo4j.EagerResultTransformer,
		neo4j.ExecuteQueryWithReadersRouting(),
	)
	if err != nil {
		return nil, err
	}

	counts := make(map[string]int64, len(result.Records))
	for _, record := range result.Records {
		code, _ := record.Get("code")
		chapters, _ := record.Get("chapters")
		codeStr, okCode := code.(string)
		chaptersInt, okChapters := chapters.(int64)
		if okCode && okChapters {
			counts[codeStr] = chaptersInt
		}
	}
	return counts, nil
}

// ---------------------------------------------------------------------------
// PostgreSQL implementation of TextRepository
// ---------------------------------------------------------------------------

type PostgresTextRepository struct {
	pool *pgxpool.Pool
}

var _ TextRepository = (*PostgresTextRepository)(nil)

func NewPostgresTextRepository(pool *pgxpool.Pool) *PostgresTextRepository {
	return &PostgresTextRepository{pool: pool}
}

func (repo *PostgresTextRepository) ChapterVerses(ctx context.Context, bookCode string, chapter int, lang, translationID string) ([]Verse, error) {
	// Entity IDs are BOOK.CHAPTER.VERSE, so a "JHN.3." prefix match selects
	// exactly one chapter (the trailing dot rules out JHN.30.*).
	prefix := fmt.Sprintf("%s.%d.", bookCode, chapter)

	// A pinned translation wins over the UI language: the edition already
	// determines its own language, so filtering by lang too would return
	// nothing whenever they differ.
	sql := `
		SELECT DISTINCT ON (entity_id)
		       entity_id, language_code, translation_id, raw_content
		FROM text_documents
		WHERE entity_id LIKE $1 || '%'`
	args := []any{prefix}
	if translationID != "" {
		sql += ` AND translation_id = $2`
		args = append(args, translationID)
	} else {
		sql += ` AND language_code = $2`
		args = append(args, lang)
	}
	sql += ` ORDER BY entity_id, translation_id`

	rows, err := repo.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var verses []Verse
	for rows.Next() {
		var v Verse
		if err := rows.Scan(&v.EntityID, &v.LanguageCode, &v.TranslationID, &v.Text); err != nil {
			return nil, err
		}
		v.Number = verseNumber(v.EntityID)
		verses = append(verses, v)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// entity_id sorts lexicographically (JHN.3.10 < JHN.3.2), so order by
	// the numeric verse component instead.
	sort.Slice(verses, func(i, j int) bool { return verses[i].Number < verses[j].Number })
	return verses, nil
}

func (repo *PostgresTextRepository) VerseText(ctx context.Context, entityID, lang, translationID string) (*Verse, error) {
	// Same rule as ChapterVerses: a pinned translation overrides lang.
	sql := `
		SELECT entity_id, language_code, translation_id, raw_content
		FROM text_documents
		WHERE entity_id = $1`
	args := []any{entityID}
	if translationID != "" {
		sql += ` AND translation_id = $2`
		args = append(args, translationID)
	} else {
		sql += ` AND language_code = $2`
		args = append(args, lang)
	}
	sql += ` ORDER BY translation_id LIMIT 1`

	rows, err := repo.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, rows.Err()
	}
	var v Verse
	if err := rows.Scan(&v.EntityID, &v.LanguageCode, &v.TranslationID, &v.Text); err != nil {
		return nil, err
	}
	v.Number = verseNumber(v.EntityID)
	return &v, nil
}

func (repo *PostgresTextRepository) DailyFeature(ctx context.Context, date string) (*DailyFeature, error) {
	var ids []string
	var catechismNums []int
	var image *string
	err := repo.pool.QueryRow(ctx,
		`SELECT verse_ids, image_url, catechism_numbers
		 FROM daily_features WHERE feature_date = $1`, date).
		Scan(&ids, &image, &catechismNums)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	f := &DailyFeature{VerseIDs: ids, CatechismNumbers: catechismNums}
	if image != nil {
		f.ImageURL = *image
	}
	return f, nil
}

func (repo *PostgresTextRepository) CatechismParagraphs(ctx context.Context, numbers []int, lang string) ([]CatechismParagraph, error) {
	if len(numbers) == 0 {
		return nil, nil
	}
	rows, err := repo.pool.Query(ctx,
		`SELECT CAST(split_part(entity_id, '.', 2) AS INT) AS num, raw_content
		 FROM text_documents
		 WHERE entity_id LIKE 'CCC.%' AND language_code = $1
		   AND CAST(split_part(entity_id, '.', 2) AS INT) = ANY($2::int[])
		 ORDER BY num`,
		lang, numbers)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byNumber := map[int]string{}
	for rows.Next() {
		var num int
		var text string
		if err := rows.Scan(&num, &text); err != nil {
			return nil, err
		}
		byNumber[num] = text
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Preserve the requested order (dates may list paragraphs out of order).
	out := make([]CatechismParagraph, 0, len(numbers))
	for _, n := range numbers {
		if text, ok := byNumber[n]; ok {
			out = append(out, CatechismParagraph{Number: n, Text: text})
		}
	}
	return out, nil
}

func (repo *PostgresTextRepository) SearchVerses(ctx context.Context, query, translationID string, limit int) ([]SearchHit, error) {
	const sql = `
		SELECT entity_id, raw_content
		FROM text_documents
		WHERE entity_id ~ '^[A-Z0-9]+\.[0-9]+\.[0-9]+$'
		  AND ($2 = '' OR translation_id = $2)
		  AND to_tsvector('simple_unaccent', raw_content) @@ plainto_tsquery('simple_unaccent', $1)
		ORDER BY ts_rank(to_tsvector('simple_unaccent', raw_content), plainto_tsquery('simple_unaccent', $1)) DESC, entity_id
		LIMIT $3`
	rows, err := repo.pool.Query(ctx, sql, query, translationID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hits []SearchHit
	for rows.Next() {
		var h SearchHit
		if err := rows.Scan(&h.EntityID, &h.Text); err != nil {
			return nil, err
		}
		hits = append(hits, h)
	}
	return hits, rows.Err()
}

func (repo *PostgresTextRepository) Translations(ctx context.Context) ([]Translation, error) {
	// Only Bible editions: verse entity IDs are BOOK.CHAPTER.VERSE, which
	// excludes the Catechism (CCC.<n>) and any other non-verse text.
	const sql = `
		SELECT translation_id, language_code, count(*)
		FROM text_documents
		WHERE entity_id ~ '^[A-Z0-9]+\.[0-9]+\.[0-9]+$'
		GROUP BY translation_id, language_code
		ORDER BY language_code, translation_id`

	rows, err := repo.pool.Query(ctx, sql)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var translations []Translation
	for rows.Next() {
		var t Translation
		if err := rows.Scan(&t.ID, &t.LanguageCode, &t.VerseCount); err != nil {
			return nil, err
		}
		translations = append(translations, t)
	}
	return translations, rows.Err()
}

// verseNumber extracts the trailing verse component of BOOK.CHAPTER.VERSE.
func verseNumber(entityID string) int {
	idx := strings.LastIndexByte(entityID, '.')
	if idx < 0 {
		return 0
	}
	n, _ := strconv.Atoi(entityID[idx+1:])
	return n
}
