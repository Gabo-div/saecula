package cmd

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	"saecula/cli/internal/scrape"
)

var citationsOpts struct {
	lang string
	all  bool
	out  string
}

var scrapeCitationsCmd = &cobra.Command{
	Use:   "citations",
	Short: "Extract every citation the Catechism makes (Scripture, documents, saints, …)",
	Long: `Scans the Catechism of the Catholic Church across its editions
(vatican.va) and extracts, per paragraph, every cited entity — Scripture
verses, Church documents (Vatican II, encyclicals, …), Denzinger numbers,
saints and their works, councils, and liturgical texts — normalized to
canonical ids so the editions can be merged.

This is a reconnaissance pass: it does NOT write to any database. Its output
is a catalog (data/citations_catechism.json) of every unique entity
the Catechism cites, which tells you what content to add to the app and where
the future relationship seeding should point.

--lang scrapes one edition (en, es or la); --all (default) scrapes all three
and merges them. The Spanish edition carries the richest inline citations.`,
	Example: `  saecula-cli scrape citations --all
  saecula-cli scrape citations --lang es
  saecula-cli scrape citations --lang es --out data/cat_cites_es.json`,
	RunE: runScrapeCitations,
}

func runScrapeCitations(cmd *cobra.Command, _ []string) error {
	var langs []string
	if !citationsOpts.all && citationsOpts.lang != "" {
		switch citationsOpts.lang {
		case "en", "es", "la":
			langs = []string{citationsOpts.lang}
		default:
			return fmt.Errorf("unsupported --lang %q (want en, es or la)", citationsOpts.lang)
		}
	} else {
		langs = []string{"es", "en", "la"}
	}

	var editions []*scrape.CatechismCitations
	for _, lang := range langs {
		scraper, err := scrape.NewVaticanCatechismCitationsScraper(scrape.NewHTTPFetcher(nil), lang)
		if err != nil {
			return err
		}
		fmt.Printf("Scraping citations (%s, ~100 pages, be patient)…\n", lang)
		ed, err := scraper.ScrapeCitations(cmd.Context(), func(line string) {
			fmt.Println("  " + line)
		})
		if err != nil {
			return err
		}
		paragraphs := 0
		for _, p := range ed.Paragraphs {
			paragraphs += len(p.Citations)
		}
		fmt.Printf("  %s: %d paragraphs with citations (%d citations)\n", lang, len(ed.Paragraphs), paragraphs)
		editions = append(editions, ed)
	}

	catalog := scrape.MergeCatalog(editions)
	if err := catalog.SaveJSON(citationsOpts.out); err != nil {
		return fmt.Errorf("write %s: %w", citationsOpts.out, err)
	}

	printCitationSummary(catalog)
	fmt.Printf("\nCatalog written to %s\n", citationsOpts.out)
	return nil
}

func printCitationSummary(c *scrape.Catalog) {
	s := c.BuildSummary()
	fmt.Println("\n=== Catechism Citations Catalog ===")
	fmt.Printf("Total unique entities: %d\n", s.TotalEntities)
	fmt.Printf("Scripture references:  %d unique verses\n", s.ScriptureCount)
	fmt.Printf("Church documents:      %d\n", s.DocumentCount)
	fmt.Printf("Saints/Doctors:        %d\n", s.SaintCount)
	fmt.Printf("Patristic works:       %d\n", s.WorkCount)
	fmt.Printf("Councils:              %d\n", s.CouncilCount)
	fmt.Printf("Denzinger references:  %d\n", s.DenzingerCount)
	fmt.Printf("Liturgical/creeds:     %d\n", s.LiturgicalCount)

	printTop("Top Scripture", s.TopScripture)
	printTop("Top documents", s.TopDocuments)
	printTop("Top saints", s.TopSaints)
	printTop("Top works", s.TopWorks)
	printTop("Top councils", s.TopCouncils)
}

func printTop(title string, rows [][]string) {
	if len(rows) == 0 {
		return
	}
	fmt.Printf("\n%s:\n", title)
	for _, r := range rows {
		fmt.Printf("  %-40s %s\n", r[0], strings.Join(r[1:], " "))
	}
}

func init() {
	scrapeCitationsCmd.Flags().StringVar(&citationsOpts.lang, "lang", "",
		"language edition to scrape: en, es or la (default: all three)")
	scrapeCitationsCmd.Flags().BoolVar(&citationsOpts.all, "all", false,
		"scrape and merge all three editions (default)")
	scrapeCitationsCmd.Flags().StringVar(&citationsOpts.out, "out", "data/citations_catechism.json",
		"output catalog JSON file")
	scrapeCmd.AddCommand(scrapeCitationsCmd)
}
