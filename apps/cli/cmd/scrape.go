package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"

	"saecula/cli/internal/scrape"
)

// scrapeOpts is shared by the root command (scrape is the default action
// in non-interactive contexts) and the explicit `scrape` subcommand.
var scrapeOpts struct {
	out string
}

func registerScrapeFlags(flags *pflag.FlagSet) {
	flags.StringVar(&scrapeOpts.out, "out", "data/bible_cee.json", "output JSON file")
}

var scrapeCmd = &cobra.Command{
	Use:   "scrape",
	Short: "Download the complete CEE Bible into one generic JSON document (no database)",
	Long: `Downloads every book of the canon from conferenciaepiscopal.es
(Sagrada Biblia CEE 2011, Spanish) and writes ONE JSON document containing
the whole Bible: books → chapters → verses.

Books carry canonical USFM codes and English slugs from the shared catalog
(libs/canon), so entity IDs are identical across all Bible sources.
Temporal metadata (composition years, era) also comes from the catalog.`,
	Example: `  saecula-cli scrape
  saecula-cli scrape --out data/bible_cee.json`,
	RunE: runScrape,
}

func runScrape(cmd *cobra.Command, _ []string) error {
	scraper := scrape.NewCEEScraper(scrape.NewHTTPFetcher(nil))

	fmt.Println("Scraping the complete CEE Bible (~70 pages, be patient)…")
	doc, err := scraper.ScrapeBible(cmd.Context(), func(line string) {
		fmt.Println("  " + line)
	})
	if err != nil {
		return err
	}

	if err := doc.SaveJSON(scrapeOpts.out); err != nil {
		return fmt.Errorf("write %s: %w", scrapeOpts.out, err)
	}

	books, chapters, verses := 0, 0, 0
	for _, b := range doc.Books {
		books++
		chapters += len(b.Chapters)
		for _, c := range b.Chapters {
			verses += len(c.Verses)
		}
	}
	fmt.Printf("\nDone: %d books, %d chapters, %d verses → %s\n", books, chapters, verses, scrapeOpts.out)
	fmt.Printf("Seed it with: saecula-cli seed --file %s\n", scrapeOpts.out)
	return nil
}

func init() {
	// Same flag on both: `saecula-cli --out …` and `saecula-cli scrape --out …`.
	registerScrapeFlags(rootCmd.Flags())
	registerScrapeFlags(scrapeCmd.Flags())
	rootCmd.AddCommand(scrapeCmd)
}
