package bible

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"

	"saecula/db/gen"
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
	// BookNames returns the source book titles keyed by USFM code for one
	// edition (translationID) or language, e.g. {"GEN": "Génesis"}.
	BookNames(ctx context.Context, lang, translationID string) (map[string]string, error)
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
	q *gen.Queries
}

var _ TextRepository = (*PostgresTextRepository)(nil)

func NewPostgresTextRepository(pool *pgxpool.Pool) *PostgresTextRepository {
	return &PostgresTextRepository{q: gen.New(pool)}
}

func (repo *PostgresTextRepository) ChapterVerses(ctx context.Context, bookCode string, chapter int, lang, translationID string) ([]Verse, error) {
	// Entity IDs are BOOK.CHAPTER.VERSE, so a "JHN.3." prefix match selects
	// exactly one chapter (the trailing dot rules out JHN.30.*).
	prefix := fmt.Sprintf("%s.%d.", bookCode, chapter)

	// A pinned translation wins over the UI language: the edition already
	// determines its own language, so filtering by lang too would return
	// nothing whenever they differ.
	rows, err := repo.q.ChapterVerses(ctx, gen.ChapterVersesParams{
		Prefix:        prefix,
		TranslationID: translationID,
		Lang:          lang,
	})
	if err != nil {
		return nil, err
	}

	verses := make([]Verse, len(rows))
	for i, r := range rows {
		verses[i] = Verse{
			EntityID:      r.EntityID,
			LanguageCode:  r.LanguageCode,
			TranslationID: r.TranslationID,
			Text:          r.RawContent,
			Number:        verseNumber(r.EntityID),
		}
	}

	// entity_id sorts lexicographically (JHN.3.10 < JHN.3.2), so order by
	// the numeric verse component instead.
	sort.Slice(verses, func(i, j int) bool { return verses[i].Number < verses[j].Number })
	return verses, nil
}

func (repo *PostgresTextRepository) VerseText(ctx context.Context, entityID, lang, translationID string) (*Verse, error) {
	// Same rule as ChapterVerses: a pinned translation overrides lang.
	r, err := repo.q.VerseText(ctx, gen.VerseTextParams{
		EntityID:      entityID,
		TranslationID: translationID,
		Lang:          lang,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &Verse{
		EntityID:      r.EntityID,
		LanguageCode:  r.LanguageCode,
		TranslationID: r.TranslationID,
		Text:          r.RawContent,
		Number:        verseNumber(r.EntityID),
	}, nil
}

func (repo *PostgresTextRepository) DailyFeature(ctx context.Context, date string) (*DailyFeature, error) {
	d, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, err
	}
	row, err := repo.q.DailyFeature(ctx, d)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	nums := make([]int, len(row.CatechismNumbers))
	for i, n := range row.CatechismNumbers {
		nums[i] = int(n)
	}
	f := &DailyFeature{VerseIDs: row.VerseIds, CatechismNumbers: nums}
	if row.ImageUrl != nil {
		f.ImageURL = *row.ImageUrl
	}
	return f, nil
}

func (repo *PostgresTextRepository) CatechismParagraphs(ctx context.Context, numbers []int, lang string) ([]CatechismParagraph, error) {
	if len(numbers) == 0 {
		return nil, nil
	}
	nums32 := make([]int32, len(numbers))
	for i, n := range numbers {
		nums32[i] = int32(n)
	}
	rows, err := repo.q.CatechismParagraphsByNumbers(ctx, gen.CatechismParagraphsByNumbersParams{
		LanguageCode: lang,
		Column2:      nums32,
	})
	if err != nil {
		return nil, err
	}

	byNumber := make(map[int]string, len(rows))
	for _, r := range rows {
		byNumber[int(r.Num)] = r.RawContent
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
	rows, err := repo.q.SearchVerses(ctx, gen.SearchVersesParams{
		TranslationID: translationID,
		Query:         query,
		Lim:           int32(limit),
	})
	if err != nil {
		return nil, err
	}
	hits := make([]SearchHit, len(rows))
	for i, r := range rows {
		hits[i] = SearchHit{EntityID: r.EntityID, Text: r.RawContent}
	}
	return hits, nil
}

func (repo *PostgresTextRepository) Translations(ctx context.Context) ([]Translation, error) {
	// Only Bible editions: verse entity IDs are BOOK.CHAPTER.VERSE, which
	// excludes the Catechism (CCC.<n>) and any other non-verse text.
	rows, err := repo.q.BibleTranslations(ctx)
	if err != nil {
		return nil, err
	}
	translations := make([]Translation, len(rows))
	for i, r := range rows {
		translations[i] = Translation{ID: r.TranslationID, LanguageCode: r.LanguageCode, VerseCount: r.VerseCount}
	}
	return translations, nil
}

func (repo *PostgresTextRepository) BookNames(ctx context.Context, lang, translationID string) (map[string]string, error) {
	rows, err := repo.q.BookNames(ctx, gen.BookNamesParams{TranslationID: translationID, Lang: lang})
	if err != nil {
		return nil, err
	}
	names := make(map[string]string, len(rows))
	for _, r := range rows {
		names[strings.TrimPrefix(r.EntityID, "BOOK.")] = r.RawContent
	}
	return names, nil
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
