// Package mcptools defines the tools the AI assistant may use to read the
// app's own content and concept graph: Scripture, the Catechism, and their
// Neo4j relationships. Tools are the single source of truth for what the model
// can access; they are thin, read-only wrappers over the existing stores and
// return compact JSON (ids + text) so the model can cite by id (JHN.3.16,
// CCC.2077). They are Genkit tools, used in-process by the chat agent and
// served to external hosts over MCP (internal/mcpapi) — one definition, two
// transports, no tool body aware of either.
package mcptools

import (
	"context"
	"fmt"
	"strings"

	"github.com/firebase/genkit/go/ai"
	"github.com/firebase/genkit/go/genkit"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"

	"saecula/back/internal/bible"
	"saecula/db/gen"
)

// ScriptureRepo is the slice of the Bible text store the tools need.
type ScriptureRepo interface {
	SearchVerses(ctx context.Context, query, translationID string, limit int) ([]bible.SearchHit, error)
	ChapterVerses(ctx context.Context, bookCode string, chapter int, lang, translationID string) ([]bible.Verse, error)
}

// Deps are the stores the tools read from.
type Deps struct {
	Scripture ScriptureRepo
	Pool      *pgxpool.Pool
	Neo4j     neo4j.DriverWithContext
}

const maxResults = 15

// Register defines every tool on the Genkit instance and returns them. The
// chat agent takes them as refs for WithTools; the MCP endpoint needs the full
// ai.Tool to read each definition's schema, so this returns the richer type.
func Register(g *genkit.Genkit, d Deps) []ai.Tool {
	return []ai.Tool{
		genkit.DefineTool(g, "search_scripture",
			"Full-text search the Bible. Returns matching verses with their id (e.g. JHN.3.16) and text. Use before quoting or citing Scripture.",
			d.searchScripture),
		genkit.DefineTool(g, "get_verses",
			"Read a specific passage: a whole chapter, or a verse range within it. Returns verses with id, number and text.",
			d.getVerses),
		genkit.DefineTool(g, "search_catechism",
			"Full-text search the Catechism of the Catholic Church. Returns paragraph numbers and snippets. Use before quoting or citing the Catechism.",
			d.searchCatechism),
		genkit.DefineTool(g, "get_catechism",
			"Read Catechism paragraphs by number range (e.g. from 1996 to 2005). Returns paragraph numbers and full text.",
			d.getCatechism),
		genkit.DefineTool(g, "graph_related",
			"Find entities related to a given id in the concept graph — e.g. the liturgical days that read a verse, or the verses a day reads. Input is an entity id like JHN.3.16 or a liturgical day id.",
			d.graphRelated),
	}
}

// ---- search_scripture ----

type searchScriptureIn struct {
	Query       string `json:"query"`
	Translation string `json:"translation,omitempty"` // edition id; empty = all editions
}

type scriptureHit struct {
	EntityID string `json:"entity_id"`
	Text     string `json:"text"`
}

func (d Deps) searchScripture(ctx *ai.ToolContext, in searchScriptureIn) ([]scriptureHit, error) {
	q := strings.TrimSpace(in.Query)
	if q == "" {
		return nil, fmt.Errorf("query is required")
	}
	rows, err := d.Scripture.SearchVerses(ctx.Context, q, in.Translation, maxResults)
	if err != nil {
		return nil, err
	}
	out := make([]scriptureHit, 0, len(rows))
	for _, r := range rows {
		out = append(out, scriptureHit{EntityID: r.EntityID, Text: r.Text})
	}
	return out, nil
}

// ---- get_verses ----

type getVersesIn struct {
	Book      string `json:"book"`    // book code, e.g. JHN
	Chapter   int    `json:"chapter"` // 1-based
	VerseFrom int    `json:"verse_from,omitempty"`
	VerseTo   int    `json:"verse_to,omitempty"`
	Lang      string `json:"lang,omitempty"`
}

type verseOut struct {
	EntityID string `json:"entity_id"`
	Number   int    `json:"number"`
	Text     string `json:"text"`
}

func (d Deps) getVerses(ctx *ai.ToolContext, in getVersesIn) ([]verseOut, error) {
	book := strings.ToUpper(strings.TrimSpace(in.Book))
	if book == "" || in.Chapter < 1 {
		return nil, fmt.Errorf("book and chapter are required")
	}
	lang := in.Lang
	if lang == "" {
		lang = "en"
	}
	verses, err := d.Scripture.ChapterVerses(ctx.Context, book, in.Chapter, lang, "")
	if err != nil {
		return nil, err
	}
	out := make([]verseOut, 0, len(verses))
	for _, v := range verses {
		if in.VerseFrom > 0 && v.Number < in.VerseFrom {
			continue
		}
		if in.VerseTo > 0 && v.Number > in.VerseTo {
			continue
		}
		out = append(out, verseOut{EntityID: v.EntityID, Number: v.Number, Text: v.Text})
	}
	return out, nil
}

// ---- search_catechism ----

type searchCatechismIn struct {
	Query string `json:"query"`
	Lang  string `json:"lang,omitempty"`
}

type catechismHit struct {
	Number  int    `json:"number"`
	Snippet string `json:"snippet"`
}

func (d Deps) searchCatechism(ctx *ai.ToolContext, in searchCatechismIn) ([]catechismHit, error) {
	q := strings.TrimSpace(in.Query)
	if q == "" {
		return nil, fmt.Errorf("query is required")
	}
	lang := in.Lang
	if lang == "" {
		lang = "en"
	}
	rows, err := gen.New(d.Pool).CatechismSearch(ctx.Context, gen.CatechismSearchParams{
		Query: q,
		Lang:  lang,
		Lim:   int32(maxResults),
	})
	if err != nil {
		return nil, err
	}
	out := make([]catechismHit, len(rows))
	for i, r := range rows {
		out[i] = catechismHit{Number: int(r.Num), Snippet: r.Snippet}
	}
	return out, nil
}

// ---- get_catechism ----

type getCatechismIn struct {
	From int    `json:"from"`
	To   int    `json:"to,omitempty"`
	Lang string `json:"lang,omitempty"`
}

type catechismParagraph struct {
	Number int    `json:"number"`
	Text   string `json:"text"`
}

func (d Deps) getCatechism(ctx *ai.ToolContext, in getCatechismIn) ([]catechismParagraph, error) {
	if in.From < 1 {
		return nil, fmt.Errorf("from must be a positive paragraph number")
	}
	to := in.To
	if to < in.From {
		to = in.From
	}
	lang := in.Lang
	if lang == "" {
		lang = "en"
	}
	rows, err := gen.New(d.Pool).CatechismRangeDistinct(ctx.Context, gen.CatechismRangeDistinctParams{
		Lang:    lang,
		FromNum: int32(in.From),
		ToNum:   int32(to),
		Lim:     int32(maxResults),
	})
	if err != nil {
		return nil, err
	}
	out := make([]catechismParagraph, len(rows))
	for i, r := range rows {
		out[i] = catechismParagraph{Number: int(r.Num), Text: r.RawContent}
	}
	return out, nil
}

// ---- graph_related ----

type graphRelatedIn struct {
	EntityID string `json:"entity_id"`
}

type graphNeighbor struct {
	EntityID string `json:"entity_id"`
	Relation string `json:"relation"`
	Label    string `json:"label"`
	Kind     string `json:"kind"`
	Outgoing bool   `json:"outgoing"`
}

func (d Deps) graphRelated(ctx *ai.ToolContext, in graphRelatedIn) ([]graphNeighbor, error) {
	id := strings.TrimSpace(in.EntityID)
	if id == "" {
		return nil, fmt.Errorf("entity_id is required")
	}
	const cypher = `
		MATCH (n {id: $id})-[r]-(m)
		RETURN type(r) AS relation,
		       startNode(r).id = $id AS outgoing,
		       m.id AS id,
		       coalesce(m.title, m.book + ' ' + toString(m.chapter) + ':' + toString(m.number), m.id) AS label,
		       labels(m)[0] AS kind
		LIMIT $limit`
	res, err := neo4j.ExecuteQuery(ctx.Context, d.Neo4j, cypher,
		map[string]any{"id": id, "limit": maxResults},
		neo4j.EagerResultTransformer,
		neo4j.ExecuteQueryWithReadersRouting(),
	)
	if err != nil {
		return nil, err
	}
	out := []graphNeighbor{}
	for _, rec := range res.Records {
		var n graphNeighbor
		if v, ok := rec.Get("relation"); ok {
			n.Relation, _ = v.(string)
		}
		if v, ok := rec.Get("outgoing"); ok {
			n.Outgoing, _ = v.(bool)
		}
		if v, ok := rec.Get("id"); ok {
			n.EntityID, _ = v.(string)
		}
		if v, ok := rec.Get("label"); ok {
			n.Label, _ = v.(string)
		}
		if v, ok := rec.Get("kind"); ok {
			n.Kind, _ = v.(string)
		}
		out = append(out, n)
	}
	return out, nil
}
