package cmd

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"

	"saecula/cli/internal/model"
	"saecula/cli/internal/scrape"
)

// scrapeCmd groups the per-source scrapers. Running it bare keeps the
// historical behavior: scrape the CEE Bible.
var scrapeCmd = &cobra.Command{
	Use:   "scrape",
	Short: "Download a source into one generic JSON document (no database)",
	Long: `Scrapers download a remote source and write ONE generic JSON document
that the seed command can load. Pick the source as a subcommand:

  bible     : the complete CEE Bible (books → chapters → verses)
  readings  : USCCB daily Mass readings (verse references only)
  catechism : the Catechism of the Catholic Church (numbered paragraphs)

Running scrape with no subcommand scrapes the Bible (historical default).`,
	Example: `  saecula-cli scrape bible
  saecula-cli scrape readings --year 2026`,
	RunE: runScrapeBible, // backwards compatible: `scrape --out …`
}

// bibleOpts is shared by the root command (bible scrape is the default
// action in non-interactive contexts), bare `scrape`, and `scrape bible`.
var bibleOpts struct {
	out    string
	source string
}

func registerBibleFlags(flags *pflag.FlagSet) {
	flags.StringVar(&bibleOpts.out, "out", "", "output JSON file (default depends on --source)")
	flags.StringVar(&bibleOpts.source, "source", "cee", "bible source: cee (Spanish), nova (Latin Nova Vulgata), web (English WEB-CE)")
}

// bibleSource describes one selectable Bible source.
type bibleSource struct {
	label      string
	defaultOut string
	newScraper func() bibleScraper
}

// bibleScraper is the shared shape of every Bible scraper.
type bibleScraper interface {
	ScrapeBible(ctx context.Context, progress func(string)) (*model.Document, error)
}

var bibleSources = map[string]bibleSource{
	"cee": {
		label:      "the complete CEE Bible (~70 pages, be patient)",
		defaultOut: "data/bible_cee.json",
		newScraper: func() bibleScraper { return scrape.NewCEEScraper(scrape.NewHTTPFetcher(nil)) },
	},
	"nova": {
		label:      "the complete Nova Vulgata (Latin, ~73 pages, be patient)",
		defaultOut: "data/bible_nova_vulgata.json",
		newScraper: func() bibleScraper { return scrape.NewNovaVulgataScraper(scrape.NewHTTPFetcher(nil)) },
	},
	"web": {
		label:      "the complete WEB-CE Bible (English, one USFM download)",
		defaultOut: "data/bible_web_ce.json",
		newScraper: func() bibleScraper { return scrape.NewWEBScraper(scrape.NewHTTPFetcher(nil)) },
	},
}

var scrapeBibleCmd = &cobra.Command{
	Use:   "bible",
	Short: "Download a complete Bible into one generic JSON document",
	Long: `Downloads every book of the canon and writes ONE JSON document
containing the whole Bible: books → chapters → verses. Pick the source with
--source:

  cee   : Sagrada Biblia CEE 2011 (Spanish, conferenciaepiscopal.es)
  nova  : Nova Vulgata (official Latin, vatican.va)
  web   : World English Bible, Catholic Edition (English, ebible.org)

Books carry canonical USFM codes and English slugs from the shared catalog
(libs/canon), so entity IDs are identical across all Bible sources.
Temporal metadata (composition years, era) also comes from the catalog.`,
	Example: `  saecula-cli scrape bible                 # CEE (default)
  saecula-cli scrape bible --source nova   # Latin Nova Vulgata
  saecula-cli scrape bible --source web    # English WEB-CE`,
	RunE: runScrapeBible,
}

func runScrapeBible(cmd *cobra.Command, _ []string) error {
	src, ok := bibleSources[bibleOpts.source]
	if !ok {
		return fmt.Errorf("unknown --source %q (want cee, nova or web)", bibleOpts.source)
	}
	out := bibleOpts.out
	if out == "" {
		out = src.defaultOut
	}

	fmt.Printf("Scraping %s…\n", src.label)
	doc, err := src.newScraper().ScrapeBible(cmd.Context(), func(line string) {
		fmt.Println("  " + line)
	})
	if err != nil {
		return err
	}

	if err := doc.SaveJSON(out); err != nil {
		return fmt.Errorf("write %s: %w", out, err)
	}

	books, chapters, verses := 0, 0, 0
	for _, b := range doc.Books {
		books++
		chapters += len(b.Chapters)
		for _, c := range b.Chapters {
			verses += len(c.Verses)
		}
	}
	fmt.Printf("\nDone: %d books, %d chapters, %d verses → %s\n", books, chapters, verses, out)
	fmt.Printf("Seed it with: saecula-cli seed --file %s\n", out)
	return nil
}

func init() {
	// Same flag everywhere the bible scrape can start from:
	// `saecula-cli --out …`, `saecula-cli scrape --out …`, `saecula-cli scrape bible --out …`.
	registerBibleFlags(rootCmd.Flags())
	registerBibleFlags(scrapeCmd.Flags())
	registerBibleFlags(scrapeBibleCmd.Flags())
	scrapeCmd.AddCommand(scrapeBibleCmd)
	rootCmd.AddCommand(scrapeCmd)
}
