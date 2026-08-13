package cmd

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"

	"saecula/cli/internal/model"
	"saecula/cli/internal/scrape"
)

var catechismOpts struct {
	out  string
	lang string
}

var scrapeCatechismCmd = &cobra.Command{
	Use:   "catechism",
	Short: "Download the Catechism of the Catholic Church into one generic JSON document",
	Long: `Downloads every numbered paragraph (1–2865) of the Catechism of the
Catholic Church and writes ONE JSON document.

English (--lang en, default) comes from the St. Charles Borromeo
transcription (scborromeo.org); Spanish (es) and Latin (la) come from the
Holy See's own site (vatican.va).

Paragraphs seed as CatechismParagraph nodes (id "CCC.<number>") plus their
localized text. Scripture cross-references are not resolved to verse IDs yet.`,
	Example: `  saecula-cli scrape catechism
  saecula-cli scrape catechism --lang es
  saecula-cli scrape catechism --lang la --out data/catechism_ccc_la.json`,
	RunE: runScrapeCatechism,
}

type catechismScraper interface {
	ScrapeCatechism(ctx context.Context, progress func(string)) (*model.Document, error)
}

func runScrapeCatechism(cmd *cobra.Command, _ []string) error {
	var scraper catechismScraper
	switch catechismOpts.lang {
	case "en":
		scraper = scrape.NewCatechismScraper(scrape.NewHTTPFetcher(nil))
	case "es", "la":
		s, err := scrape.NewVaticanCatechismScraper(scrape.NewHTTPFetcher(nil), catechismOpts.lang)
		if err != nil {
			return err
		}
		scraper = s
	default:
		return fmt.Errorf("unsupported --lang %q (want en, es or la)", catechismOpts.lang)
	}

	out := catechismOpts.out
	if out == "" {
		out = fmt.Sprintf("data/catechism_ccc_%s.json", catechismOpts.lang)
	}

	fmt.Printf("Scraping the Catechism (%s, ~100 pages, be patient)…\n", catechismOpts.lang)
	doc, err := scraper.ScrapeCatechism(cmd.Context(), func(line string) {
		fmt.Println("  " + line)
	})
	if err != nil {
		return err
	}

	if err := doc.SaveJSON(out); err != nil {
		return fmt.Errorf("write %s: %w", out, err)
	}

	fmt.Printf("\nDone: %d paragraphs → %s\n", len(doc.Paragraphs), out)
	fmt.Printf("Seed it with: saecula-cli seed --file %s\n", out)
	return nil
}

func init() {
	scrapeCatechismCmd.Flags().StringVar(&catechismOpts.out, "out", "",
		"output JSON file (default data/catechism_ccc_<lang>.json)")
	scrapeCatechismCmd.Flags().StringVar(&catechismOpts.lang, "lang", "en",
		"language edition: en (scborromeo), es or la (vatican.va)")
	scrapeCmd.AddCommand(scrapeCatechismCmd)
}
