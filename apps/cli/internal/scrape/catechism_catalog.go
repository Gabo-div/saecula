package scrape

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strconv"
)

// EntityRef aggregates every paragraph (and edition) that cites one entity.
type EntityRef struct {
	Count      int              `json:"count"`
	Paragraphs map[int][]string `json:"paragraphs"` // CCC paragraph -> editions
}

// DocRef is a cited document with its provenance metadata when known.
type DocRef struct {
	Count      int              `json:"count"`
	Paragraphs map[int][]string `json:"paragraphs"`
	Title      string           `json:"title,omitempty"`
	Kind       string           `json:"kind,omitempty"`
	Date       string           `json:"date,omitempty"`
}

// Catalog is the deduplicated, cross-edition summary of every entity the
// Catechism cites — the reconnaissance report for "what content to add".
type Catalog struct {
	Scripture  map[string]*EntityRef `json:"scripture"`
	Documents  map[string]*DocRef    `json:"documents"`
	Saints     map[string]*EntityRef `json:"saints"`
	Works      map[string]*EntityRef `json:"works"`
	Councils   map[string]*EntityRef `json:"councils"`
	Denzinger  map[string]*EntityRef `json:"denzinger"`
	Liturgical map[string]*EntityRef `json:"liturgical"`
}

// MergeCatalog combines one or more editions' citation scrapes into a single
// deduplicated catalog. A citation of the same entity from the same paragraph
// in a second edition records that edition but counts once.
func MergeCatalog(editions []*CatechismCitations) *Catalog {
	c := &Catalog{
		Scripture:  map[string]*EntityRef{},
		Documents:  map[string]*DocRef{},
		Saints:     map[string]*EntityRef{},
		Works:      map[string]*EntityRef{},
		Councils:   map[string]*EntityRef{},
		Denzinger:  map[string]*EntityRef{},
		Liturgical: map[string]*EntityRef{},
	}
	for _, ed := range editions {
		for _, pc := range ed.Paragraphs {
			for _, cit := range pc.Citations {
				switch cit.Type {
				case "scripture":
					recordEntity(c.Scripture, cit.ID, pc.Number, ed.LanguageCode)
				case "document":
					doc := c.doc(cit.ID)
					doc.record(pc.Number, ed.LanguageCode)
					if meta, ok := vat2DocByID[cit.ID]; ok {
						doc.Title = meta.Title
						doc.Kind = meta.Kind
						doc.Date = meta.Date
					}
				case "denzinger":
					recordEntity(c.Denzinger, cit.ID, pc.Number, ed.LanguageCode)
				case "saint":
					recordEntity(c.Saints, cit.ID, pc.Number, ed.LanguageCode)
				case "work":
					recordEntity(c.Works, cit.ID, pc.Number, ed.LanguageCode)
				case "council":
					recordEntity(c.Councils, cit.ID, pc.Number, ed.LanguageCode)
				case "liturgical":
					recordEntity(c.Liturgical, cit.ID, pc.Number, ed.LanguageCode)
				}
			}
		}
	}
	return c
}

// vat2DocByID indexes the Vatican II documents by canonical id.
var vat2DocByID = func() map[string]vat2Doc {
	m := map[string]vat2Doc{}
	for _, d := range vat2Docs {
		m[d.ID] = d
	}
	return m
}()

func (c *Catalog) doc(id string) *DocRef {
	if d, ok := c.Documents[id]; ok {
		return d
	}
	d := &DocRef{Paragraphs: map[int][]string{}}
	c.Documents[id] = d
	return d
}

func recordEntity(m map[string]*EntityRef, id string, number int, lang string) {
	e, ok := m[id]
	if !ok {
		e = &EntityRef{Paragraphs: map[int][]string{}}
		m[id] = e
	}
	e.record(number, lang)
}

func (e *EntityRef) record(number int, lang string) {
	editions := e.Paragraphs[number]
	for _, l := range editions {
		if l == lang {
			return // already recorded for this edition
		}
	}
	e.Paragraphs[number] = append(editions, lang)
	e.Count++
}

func (d *DocRef) record(number int, lang string) {
	editions := d.Paragraphs[number]
	for _, l := range editions {
		if l == lang {
			return
		}
	}
	d.Paragraphs[number] = append(editions, lang)
	d.Count++
}

// SaveJSON writes the catalog as pretty JSON.
func (c *Catalog) SaveJSON(path string) error {
	raw, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(raw, '\n'), 0o644)
}

// Summary is the console-facing digest of the catalog.
type Summary struct {
	TotalEntities   int
	ScriptureCount  int
	DocumentCount   int
	SaintCount      int
	WorkCount       int
	CouncilCount    int
	DenzingerCount  int
	LiturgicalCount int
	TopScripture    [][]string // [id, count]
	TopDocuments    [][]string
	TopSaints       [][]string
	TopWorks        [][]string
	TopCouncils     [][]string
}

// BuildSummary derives the human-readable digest for the CLI.
func (c *Catalog) BuildSummary() *Summary {
	return &Summary{
		TotalEntities:   len(c.Scripture) + len(c.Documents) + len(c.Saints) + len(c.Works) + len(c.Councils) + len(c.Denzinger) + len(c.Liturgical),
		ScriptureCount:  len(c.Scripture),
		DocumentCount:   len(c.Documents),
		SaintCount:      len(c.Saints),
		WorkCount:       len(c.Works),
		CouncilCount:    len(c.Councils),
		DenzingerCount:  len(c.Denzinger),
		LiturgicalCount: len(c.Liturgical),
		TopScripture:    topN(c.Scripture, 12),
		TopDocuments:    topN(c.Documents, 15),
		TopSaints:       topN(c.Saints, 15),
		TopWorks:        topN(c.Works, 12),
		TopCouncils:     topN(c.Councils, 10),
	}
}

type counted interface{ count() int }

func (e *EntityRef) count() int { return e.Count }
func (d *DocRef) count() int    { return d.Count }

// topN returns the n highest-count entries as [id, count] pairs, sorted by
// descending count then id.
func topN[T counted](m map[string]T, n int) [][]string {
	pairs := make([][]string, 0, len(m))
	for id, e := range m {
		pairs = append(pairs, []string{id, fmt.Sprintf("%d", e.count())})
	}
	sort.Slice(pairs, func(i, j int) bool {
		a, _ := strconv.Atoi(pairs[i][1])
		b, _ := strconv.Atoi(pairs[j][1])
		if a != b {
			return a > b
		}
		return pairs[i][0] < pairs[j][0]
	})
	if len(pairs) > n {
		pairs = pairs[:n]
	}
	return pairs
}
