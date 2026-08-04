// Package seed persists generic model.Document files into Saecula's
// dual-database store. Storage backends are injected as interfaces so the
// orchestration logic stays database-free and testable.
package seed

import (
	"context"
	"encoding/json"
	"fmt"

	"saecula/cli/internal/model"
)

// TextRecord is one row destined for PostgreSQL's text_documents table.
type TextRecord struct {
	EntityID      string
	LanguageCode  string
	TranslationID string
	RawContent    string
	Metadata      json.RawMessage
}

// GraphNode is one language-agnostic concept node destined for Neo4j.
type GraphNode struct {
	Label string // "Verse", "CatechismParagraph", ...
	ID    string // universal slug
	Props map[string]any
}

// Relationship is one edge between two concept nodes, addressed by slug.
type Relationship struct {
	FromID    string
	Type      string // "FOLLOWS", "CITES", ...
	ToID      string
	ToLabel   string // label to MERGE for the target stub
	FromLabel string // label to match for the source
}

// TextStore abstracts the localized translation store.
type TextStore interface {
	Upsert(ctx context.Context, records []TextRecord) error
}

// GraphStore abstracts the concept graph.
type GraphStore interface {
	MergeNodes(ctx context.Context, nodes []GraphNode) error
	MergeRelationships(ctx context.Context, rels []Relationship) error
}

// Report summarizes what a seed run touched.
type Report struct {
	TextsUpserted       int
	NodesMerged         int
	RelationshipsMerged int
}

// Seeder maps documents to store operations. Both stores are injected.
type Seeder struct {
	texts TextStore
	graph GraphStore
}

func New(texts TextStore, graph GraphStore) *Seeder {
	return &Seeder{texts: texts, graph: graph}
}

// SeedFile loads one generic document file and persists it.
func (s *Seeder) SeedFile(ctx context.Context, path string) (*Report, error) {
	doc, err := model.LoadJSON(path)
	if err != nil {
		return nil, err
	}
	return s.Seed(ctx, doc)
}

// Seed persists an already-parsed document.
func (s *Seeder) Seed(ctx context.Context, doc *model.Document) (*Report, error) {
	records, nodes, rels := mapDocument(doc)

	if err := s.texts.Upsert(ctx, records); err != nil {
		return nil, fmt.Errorf("upsert texts: %w", err)
	}
	if err := s.graph.MergeNodes(ctx, nodes); err != nil {
		return nil, fmt.Errorf("merge nodes: %w", err)
	}
	if len(rels) > 0 {
		if err := s.graph.MergeRelationships(ctx, rels); err != nil {
			return nil, fmt.Errorf("merge relationships: %w", err)
		}
	}

	return &Report{
		TextsUpserted:       len(records),
		NodesMerged:         len(nodes),
		RelationshipsMerged: len(rels),
	}, nil
}

// mapDocument is the pure translation from the generic document format to
// store operations — no I/O, trivially unit-testable.
func mapDocument(doc *model.Document) ([]TextRecord, []GraphNode, []Relationship) {
	var (
		records []TextRecord
		nodes   []GraphNode
		rels    []Relationship
	)

	temporal := map[string]any{
		"start_year": doc.StartYear,
		"end_year":   doc.EndYearOrStart(),
		"era":        doc.Era,
	}

	switch doc.Type {
	case model.TypeBible:
		for _, book := range doc.Books {
			for _, chapter := range book.Chapters {
				for i, v := range chapter.Verses {
					entityID := fmt.Sprintf("%s.%d.%d", book.Code, chapter.Number, v.Number)
					records = append(records, TextRecord{
						EntityID:      entityID,
						LanguageCode:  doc.LanguageCode,
						TranslationID: doc.TranslationID,
						RawContent:    v.Text,
						Metadata:      orEmptyJSON(v.Metadata),
					})

					nodes = append(nodes, GraphNode{Label: "Verse", ID: entityID, Props: map[string]any{
						"book":       book.Code,
						"book_slug":  book.Slug,
						"testament":  book.Testament,
						"chapter":    chapter.Number,
						"number":     v.Number,
						"start_year": book.StartYear,
						"end_year":   book.EndYear,
						"era":        book.Era,
					}})

					// Chain consecutive verses within the chapter.
					if i > 0 {
						prevID := fmt.Sprintf("%s.%d.%d", book.Code, chapter.Number, chapter.Verses[i-1].Number)
						rels = append(rels, Relationship{
							FromID: prevID, FromLabel: "Verse",
							Type: "FOLLOWS",
							ToID: entityID, ToLabel: "Verse",
						})
					}
				}
			}
		}

	case model.TypeBibleChapter:
		for i, v := range doc.Verses {
			entityID := fmt.Sprintf("%s.%d.%d", doc.Book, doc.Chapter, v.Number)
			records = append(records, TextRecord{
				EntityID:      entityID,
				LanguageCode:  doc.LanguageCode,
				TranslationID: doc.TranslationID,
				RawContent:    v.Text,
				Metadata:      orEmptyJSON(v.Metadata),
			})

			props := map[string]any{
				"book":    doc.Book,
				"chapter": doc.Chapter,
				"number":  v.Number,
			}
			for k, val := range temporal {
				props[k] = val
			}
			nodes = append(nodes, GraphNode{Label: "Verse", ID: entityID, Props: props})

			// Chain consecutive verses for in-order traversal.
			if i > 0 {
				prevID := fmt.Sprintf("%s.%d.%d", doc.Book, doc.Chapter, doc.Verses[i-1].Number)
				rels = append(rels, Relationship{
					FromID: prevID, FromLabel: "Verse",
					Type: "FOLLOWS",
					ToID: entityID, ToLabel: "Verse",
				})
			}
		}

	case model.TypeCatechism:
		for _, p := range doc.Paragraphs {
			entityID := fmt.Sprintf("CCC.%d", p.OfficialNumber)
			records = append(records, TextRecord{
				EntityID:      entityID,
				LanguageCode:  doc.LanguageCode,
				TranslationID: doc.TranslationID,
				RawContent:    p.Text,
				Metadata:      orEmptyJSON(p.Metadata),
			})

			props := map[string]any{"official_number": p.OfficialNumber}
			for k, val := range temporal {
				props[k] = val
			}
			nodes = append(nodes, GraphNode{Label: "CatechismParagraph", ID: entityID, Props: props})

			// Theological cross-references; the verse stub is merged by
			// the GraphStore so citations survive out-of-order seeding.
			for _, verseID := range p.RelatedVerses {
				rels = append(rels, Relationship{
					FromID: entityID, FromLabel: "CatechismParagraph",
					Type: "CITES",
					ToID: verseID, ToLabel: "Verse",
				})
			}
		}

	case model.TypeDailyReadings:
		// Reference-only: liturgical days go to the graph, nothing is
		// localized text. Verse stubs are merged by the GraphStore so
		// readings can be seeded before (or without) the bible itself.
		for _, day := range doc.Days {
			entityID := "LITDAY." + day.Date
			props := map[string]any{"date": day.Date}
			if day.Title != "" {
				props["title"] = day.Title
			}
			if day.Lectionary != "" {
				props["lectionary"] = day.Lectionary
			}
			nodes = append(nodes, GraphNode{Label: "LiturgicalDay", ID: entityID, Props: props})

			for _, r := range day.Readings {
				relType := readsRelType(r.Type)
				for _, verseID := range r.VerseIDs {
					rels = append(rels, Relationship{
						FromID: entityID, FromLabel: "LiturgicalDay",
						Type: relType,
						ToID: verseID, ToLabel: "Verse",
					})
				}
			}
		}
	}

	return records, nodes, rels
}

// readsRelType turns a reading type slug into an edge type:
// "responsorial_psalm" → "READS_RESPONSORIAL_PSALM". Cypher cannot
// parameterize relationship types, so the slug is sanitized here.
func readsRelType(readingType string) string {
	out := []rune("READS")
	if readingType != "" {
		out = append(out, '_')
	}
	for _, r := range readingType {
		switch {
		case r >= 'a' && r <= 'z':
			out = append(out, r-('a'-'A'))
		case r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
			out = append(out, r)
		default:
			out = append(out, '_')
		}
	}
	return string(out)
}

func orEmptyJSON(raw json.RawMessage) json.RawMessage {
	if raw == nil {
		return json.RawMessage(`{}`)
	}
	return raw
}
