package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"

	"saecula/cli/internal/scrape"
)

// scrapeCmd groups the per-source scrapers. Running it bare keeps the
// historical behavior: scrape the CEE Bible.
var scrapeCmd = &cobra.Command{
	Use:   "scrape",
	Short: "Download a source into one generic JSON document (no database)",
	Long: `Scrapers download a remote source and write ONE generic JSON document
that the seed command can load. Pick the source as a subcommand:

  bible    : the complete CEE Bible (books → chapters → verses)
  readings : USCCB daily Mass readings (verse references only)

Running scrape with no subcommand scrapes the Bible (historical default).`,
	Example: `  saecula-cli scrape bible
  saecula-cli scrape readings --year 2026`,
	RunE: runScrapeBible, // backwards compatible: `scrape --out …`
}

// bibleOpts is shared by the root command (bible scrape is the default
// action in non-interactive contexts), bare `scrape`, and `scrape bible`.
var bibleOpts struct {
	out string
}

func registerBibleFlags(flags *pflag.FlagSet) {
	flags.StringVar(&bibleOpts.out, "out", "data/bible_cee.json", "output JSON file")
}

var scrapeBibleCmd = &cobra.Command{
	Use:   "bible",
	Short: "Download the complete CEE Bible into one generic JSON document",
	Long: `Downloads every book of the canon from conferenciaepiscopal.es
(Sagrada Biblia CEE 2011, Spanish) and writes ONE JSON document containing
the whole Bible: books → chapters → verses.

Books carry canonical USFM codes and English slugs from the shared catalog
(libs/canon), so entity IDs are identical across all Bible sources.
Temporal metadata (composition years, era) also comes from the catalog.`,
	Example: `  saecula-cli scrape bible
  saecula-cli scrape bible --out data/bible_cee.json`,
	RunE: runScrapeBible,
}

func runScrapeBible(cmd *cobra.Command, _ []string) error {
	scraper := scrape.NewCEEScraper(scrape.NewHTTPFetcher(nil))

	fmt.Println("Scraping the complete CEE Bible (~70 pages, be patient)…")
	doc, err := scraper.ScrapeBible(cmd.Context(), func(line string) {
		fmt.Println("  " + line)
	})
	if err != nil {
		return err
	}

	if err := doc.SaveJSON(bibleOpts.out); err != nil {
		return fmt.Errorf("write %s: %w", bibleOpts.out, err)
	}

	books, chapters, verses := 0, 0, 0
	for _, b := range doc.Books {
		books++
		chapters += len(b.Chapters)
		for _, c := range b.Chapters {
			verses += len(c.Verses)
		}
	}
	fmt.Printf("\nDone: %d books, %d chapters, %d verses → %s\n", books, chapters, verses, bibleOpts.out)
	fmt.Printf("Seed it with: saecula-cli seed --file %s\n", bibleOpts.out)
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
