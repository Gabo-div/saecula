package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"saecula/cli/internal/scrape"
)

var catechismOpts struct {
	out string
}

var scrapeCatechismCmd = &cobra.Command{
	Use:   "catechism",
	Short: "Download the Catechism of the Catholic Church into one generic JSON document",
	Long: `Downloads every numbered paragraph (1–2865) of the Catechism of the
Catholic Church from the St. Charles Borromeo transcription
(scborromeo.org, English) and writes ONE JSON document.

Paragraphs seed as CatechismParagraph nodes (id "CCC.<number>") plus their
localized text. Scripture cross-references are not resolved to verse IDs yet.`,
	Example: `  saecula-cli scrape catechism
  saecula-cli scrape catechism --out data/catechism_ccc.json`,
	RunE: runScrapeCatechism,
}

func runScrapeCatechism(cmd *cobra.Command, _ []string) error {
	scraper := scrape.NewCatechismScraper(scrape.NewHTTPFetcher(nil))

	fmt.Println("Scraping the Catechism (~110 pages, be patient)…")
	doc, err := scraper.ScrapeCatechism(cmd.Context(), func(line string) {
		fmt.Println("  " + line)
	})
	if err != nil {
		return err
	}

	if err := doc.SaveJSON(catechismOpts.out); err != nil {
		return fmt.Errorf("write %s: %w", catechismOpts.out, err)
	}

	fmt.Printf("\nDone: %d paragraphs → %s\n", len(doc.Paragraphs), catechismOpts.out)
	fmt.Printf("Seed it with: saecula-cli seed --file %s\n", catechismOpts.out)
	return nil
}

func init() {
	scrapeCatechismCmd.Flags().StringVar(&catechismOpts.out, "out",
		"data/catechism_ccc.json", "output JSON file")
	scrapeCmd.AddCommand(scrapeCatechismCmd)
}
