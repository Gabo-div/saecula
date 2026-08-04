// Package model defines the generic document format that decouples the
// scraping pipeline from the seeding pipeline: scrapers PRODUCE these JSON
// documents, the seeder CONSUMES them. Any file matching this shape can be
// seeded, whether it came from a scraper or was written by hand.
package model

import (
	"encoding/json"
	"fmt"
	"os"
)

// Document types.
const (
	TypeBible         = "bible"
	TypeBibleChapter  = "bible_chapter"
	TypeCatechism     = "catechism"
	TypeDailyReadings = "daily_readings"
)

// Document is the generic scrape output / seed input envelope. Type
// selects which payload field is populated.
type Document struct {
	Type          string `json:"type"` // TypeBibleChapter | TypeCatechism
	LanguageCode  string `json:"language_code"`
	TranslationID string `json:"translation_id"`
	StartYear     int64  `json:"start_year"`
	EndYear       *int64 `json:"end_year,omitempty"`
	Era           string `json:"era,omitempty"`

	// Provenance: where and when this document was scraped from.
	SourceURL string `json:"source_url,omitempty"`
	ScrapedAt string `json:"scraped_at,omitempty"` // RFC 3339

	// bible payload: the whole (or partial) canon in one document
	Books []BookPayload `json:"books,omitempty"`

	// bible_chapter payload
	Book    string  `json:"book,omitempty"`
	Chapter int     `json:"chapter,omitempty"`
	Verses  []Verse `json:"verses,omitempty"`

	// catechism payload
	Paragraphs []CatechismParagraph `json:"paragraphs,omitempty"`

	// daily_readings payload: liturgical days with their Mass readings,
	// references only (no text — verse texts come from a bible document).
	Days []DayReadings `json:"days,omitempty"`
}

// BookPayload is one canonical book inside a TypeBible document. Code and
// Slug come from the canonical catalog (libs/canon) so they are
// identical across sources; temporal metadata is per book.
type BookPayload struct {
	Code      string           `json:"code"` // USFM, e.g. "JHN"
	Slug      string           `json:"slug"` // canonical English slug, e.g. "john"
	NameEN    string           `json:"name_en,omitempty"`
	NameES    string           `json:"name_es,omitempty"`
	Testament string           `json:"testament,omitempty"` // "OT" | "NT"
	StartYear int64            `json:"start_year"`
	EndYear   int64            `json:"end_year"`
	Era       string           `json:"era,omitempty"`
	Chapters  []ChapterPayload `json:"chapters"`
}

// ChapterPayload is one chapter of a BookPayload.
type ChapterPayload struct {
	Number int     `json:"number"`
	Verses []Verse `json:"verses"`
}

type Verse struct {
	Number   int             `json:"number"`
	Text     string          `json:"text"`
	Metadata json.RawMessage `json:"metadata,omitempty"`
}

// DayReadings is one liturgical day inside a TypeDailyReadings document.
type DayReadings struct {
	Date       string    `json:"date"` // ISO date, e.g. "2026-07-19"
	Title      string    `json:"title,omitempty"`
	Lectionary string    `json:"lectionary,omitempty"` // lectionary number as printed
	SourceURL  string    `json:"source_url,omitempty"`
	Readings   []Reading `json:"readings"`
}

// Reading is one Mass reading: the raw citation plus its normalized
// per-verse universal IDs ("WIS.12.13", same shape the seeder uses for
// entity IDs). VerseIDs may be empty when the citation could not be
// resolved (non-numeric chapters, unresolvable cross-chapter ranges).
type Reading struct {
	Type        string   `json:"type"`      // "reading_1", "responsorial_psalm", "gospel", …
	Reference   string   `json:"reference"` // as printed, e.g. "Wisdom 12:13, 16-19"
	VerseIDs    []string `json:"verse_ids,omitempty"`
	Alternative bool     `json:"alternative,omitempty"` // an "or" option of the previous reading
}

type CatechismParagraph struct {
	OfficialNumber int             `json:"official_number"`
	Text           string          `json:"text"`
	Metadata       json.RawMessage `json:"metadata,omitempty"`
	// Universal slugs of verses this paragraph cites, e.g. ["JN.3.16"].
	RelatedVerses []string `json:"related_verses,omitempty"`
}

// Validate checks the invariants the seeder relies on.
func (d *Document) Validate() error {
	if d.LanguageCode == "" || d.TranslationID == "" {
		return fmt.Errorf("language_code and translation_id are required")
	}
	switch d.Type {
	case TypeBible:
		if len(d.Books) == 0 {
			return fmt.Errorf("bible requires at least one book")
		}
		for _, b := range d.Books {
			if b.Code == "" || b.Slug == "" {
				return fmt.Errorf("every book requires code and slug")
			}
			if len(b.Chapters) == 0 {
				return fmt.Errorf("book %s has no chapters", b.Code)
			}
		}
	case TypeBibleChapter:
		if d.Book == "" || d.Chapter == 0 || len(d.Verses) == 0 {
			return fmt.Errorf("bible_chapter requires book, chapter and verses")
		}
	case TypeCatechism:
		if len(d.Paragraphs) == 0 {
			return fmt.Errorf("catechism requires paragraphs")
		}
	case TypeDailyReadings:
		if len(d.Days) == 0 {
			return fmt.Errorf("daily_readings requires at least one day")
		}
		for _, day := range d.Days {
			if day.Date == "" {
				return fmt.Errorf("every day requires a date")
			}
			if len(day.Readings) == 0 {
				return fmt.Errorf("day %s has no readings", day.Date)
			}
			for _, r := range day.Readings {
				if r.Reference == "" {
					return fmt.Errorf("day %s: reading without reference", day.Date)
				}
			}
		}
	default:
		return fmt.Errorf("unknown document type %q", d.Type)
	}
	return nil
}

// EndYearOrStart returns end_year, falling back to start_year for point
// events.
func (d *Document) EndYearOrStart() int64 {
	if d.EndYear != nil {
		return *d.EndYear
	}
	return d.StartYear
}

// LoadJSON reads and validates a document file.
func LoadJSON(path string) (*Document, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	var doc Document
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	if err := doc.Validate(); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	return &doc, nil
}

// SaveJSON writes the document as pretty-printed JSON.
func (d *Document) SaveJSON(path string) error {
	if err := d.Validate(); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(d, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(raw, '\n'), 0o644)
}
