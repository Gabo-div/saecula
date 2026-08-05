package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"charm.land/huh/v2"
	"github.com/spf13/cobra"
)

var interactiveCmd = &cobra.Command{
	Use:     "interactive",
	Aliases: []string{"i"},
	Short:   "Guided mode: pick every option from selects and prompts",
	Long: `Walks through the pipeline with interactive prompts, then runs the
same code paths as the flag-based commands.

Running saecula-cli with no arguments in a terminal also starts this mode.`,
	RunE: runInteractive,
}

func init() {
	rootCmd.AddCommand(interactiveCmd)
}

// newForm builds a huh form using the terminal's own color scheme
// (ThemeBase applies no custom palette, so system colors shine through).
func newForm(groups ...*huh.Group) *huh.Form {
	return huh.NewForm(groups...).WithTheme(huh.ThemeFunc(huh.ThemeBase))
}

// isTTY reports whether stdin is an interactive terminal.
func isTTY() bool {
	info, err := os.Stdin.Stat()
	return err == nil && info.Mode()&os.ModeCharDevice != 0
}

func runInteractive(cmd *cobra.Command, _ []string) error {
	if !isTTY() {
		return fmt.Errorf("interactive mode needs a terminal; use scrape/seed with flags instead")
	}

	var action string
	err := newForm(huh.NewGroup(
		huh.NewSelect[string]().
			Title("Saecula CLI — what do you want to do?").
			Options(
				huh.NewOption("Scrape a source into one JSON document", "scrape"),
				huh.NewOption("Seed JSON documents into PostgreSQL + Neo4j", "seed"),
			).
			Value(&action),
	)).Run()
	if err != nil {
		return err
	}

	switch action {
	case "scrape":
		return interactiveScrape(cmd)
	case "seed":
		return interactiveSeed(cmd)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Scrape wizard — pick WHAT to scrape, then WHERE from, then the details
// ---------------------------------------------------------------------------

// scrapeSources lists the available sources per scrape type. Adding a
// source here is all the wizard needs to offer it.
var scrapeSources = map[string][]huh.Option[string]{
	"bible": {
		huh.NewOption("CEE — conferenciaepiscopal.es (Sagrada Biblia 2011, Spanish)", "cee"),
	},
	"readings": {
		huh.NewOption("Vatican News (Spanish, fast, ~2018 → +3 months, no psalm)", "vaticannews"),
		huh.NewOption("USCCB (English, includes psalm, any date)", "usccb"),
	},
	"catechism": {
		huh.NewOption("St. Charles Borromeo — scborromeo.org (English, paragraphs 1–2865)", "scborromeo"),
	},
}

func interactiveScrape(cmd *cobra.Command) error {
	var scrapeType string
	err := newForm(huh.NewGroup(
		huh.NewSelect[string]().
			Title("What do you want to scrape?").
			Options(
				huh.NewOption("Bible — the complete canon, text included", "bible"),
				huh.NewOption("Daily Mass readings — verse references only", "readings"),
				huh.NewOption("Catechism — numbered paragraphs, text included", "catechism"),
			).
			Value(&scrapeType),
	)).Run()
	if err != nil {
		return err
	}

	var source string
	err = newForm(huh.NewGroup(
		huh.NewSelect[string]().
			Title("Source").
			Options(scrapeSources[scrapeType]...).
			Value(&source),
	)).Run()
	if err != nil {
		return err
	}

	switch scrapeType {
	case "bible":
		return interactiveScrapeBible(cmd)
	case "readings":
		readingsOpts.source = source
		return interactiveScrapeReadings(cmd)
	case "catechism":
		return interactiveScrapeCatechism(cmd)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Catechism scrape wizard — whole Catechism, no section picking
// ---------------------------------------------------------------------------

func interactiveScrapeCatechism(cmd *cobra.Command) error {
	outPath := catechismOpts.out
	confirmed := true

	err := newForm(huh.NewGroup(
		huh.NewInput().
			Title("Output file").
			Value(&outPath).
			Validate(validateNotEmpty),
		huh.NewConfirm().
			Title("Download the whole Catechism (~110 pages)?").
			Value(&confirmed),
	)).Run()
	if err != nil {
		return err
	}
	if !confirmed {
		return nil
	}

	catechismOpts.out = outPath
	return runScrapeCatechism(cmd, nil)
}

// ---------------------------------------------------------------------------
// Bible scrape wizard — whole Bible, no book/chapter picking
// ---------------------------------------------------------------------------

func interactiveScrapeBible(cmd *cobra.Command) error {
	outPath := bibleOpts.out
	confirmed := true

	err := newForm(huh.NewGroup(
		huh.NewInput().
			Title("Output file").
			Value(&outPath).
			Validate(validateNotEmpty),
		huh.NewConfirm().
			Title("Download the whole CEE Bible (~70 pages)?").
			Value(&confirmed),
	)).Run()
	if err != nil {
		return err
	}
	if !confirmed {
		return nil
	}

	bibleOpts.out = outPath
	return runScrapeBible(cmd, nil)
}

// ---------------------------------------------------------------------------
// Daily readings scrape wizard
// ---------------------------------------------------------------------------

// interactiveScrapeReadings assumes readingsOpts.source was already chosen
// by the scrape wizard.
func interactiveScrapeReadings(cmd *cobra.Command) error {
	mode := "year"
	err := newForm(huh.NewGroup(
		huh.NewSelect[string]().
			Title("Date range").
			Options(
				huh.NewOption("Civil year (Jan 1 – Dec 31)", "year"),
				huh.NewOption("Liturgical year (Advent to Advent)", "liturgical"),
				huh.NewOption("Custom range (from/to)", "custom"),
			).
			Value(&mode),
	)).Run()
	if err != nil {
		return err
	}

	readingsOpts.year, readingsOpts.liturgicalYear = 0, 0
	readingsOpts.from, readingsOpts.to = "", ""
	switch mode {
	case "year", "liturgical":
		year := fmt.Sprintf("%d", time.Now().Year())
		if err := newForm(huh.NewGroup(
			huh.NewInput().Title("Year").Value(&year).Validate(validateYear),
		)).Run(); err != nil {
			return err
		}
		n, _ := strconv.Atoi(strings.TrimSpace(year))
		if mode == "year" {
			readingsOpts.year = n
		} else {
			readingsOpts.liturgicalYear = n
		}
	case "custom":
		if err := newForm(huh.NewGroup(
			huh.NewInput().Title("From (YYYY-MM-DD)").Value(&readingsOpts.from).Validate(validateISODate),
			huh.NewInput().Title("To (YYYY-MM-DD)").Value(&readingsOpts.to).Validate(validateISODate),
		)).Run(); err != nil {
			return err
		}
	}

	outPath := readingsOpts.out
	if outPath == "" {
		outPath = fmt.Sprintf("data/readings_%s.json", readingsOpts.source)
	}
	confirmed := true
	err = newForm(huh.NewGroup(
		huh.NewInput().
			Title("Output file").
			Value(&outPath).
			Validate(validateNotEmpty),
		huh.NewConfirm().
			Title("Download the daily readings (one page per day)?").
			Value(&confirmed),
	)).Run()
	if err != nil {
		return err
	}
	if !confirmed {
		return nil
	}

	readingsOpts.out = outPath
	return runScrapeReadings(cmd, nil)
}

// ---------------------------------------------------------------------------
// Seed wizard
// ---------------------------------------------------------------------------

func interactiveSeed(cmd *cobra.Command) error {
	candidates := findJSONDocuments()

	var files []string
	if len(candidates) > 0 {
		options := make([]huh.Option[string], len(candidates))
		for i, f := range candidates {
			options[i] = huh.NewOption(f, f)
		}
		err := newForm(huh.NewGroup(
			huh.NewMultiSelect[string]().
				Title("Documents to seed").
				Description("Space to toggle, enter to confirm").
				Options(options...).
				Value(&files).
				Validate(func(selected []string) error {
					if len(selected) == 0 {
						return fmt.Errorf("select at least one file")
					}
					return nil
				}),
		)).Run()
		if err != nil {
			return err
		}
	} else {
		var path string
		err := newForm(huh.NewGroup(
			huh.NewInput().
				Title("No *.json documents found nearby — enter a path").
				Value(&path).
				Validate(validateNotEmpty),
		)).Run()
		if err != nil {
			return err
		}
		files = []string{path}
	}

	useDefaults := true
	err := newForm(huh.NewGroup(
		huh.NewConfirm().
			Title("Use local docker-compose defaults for PostgreSQL and Neo4j?").
			Value(&useDefaults),
	)).Run()
	if err != nil {
		return err
	}

	if !useDefaults {
		err := newForm(huh.NewGroup(
			huh.NewInput().Title("PostgreSQL DSN").Value(&seedOpts.postgresDSN).Validate(validateNotEmpty),
			huh.NewInput().Title("Neo4j Bolt URI").Value(&seedOpts.neo4jURI).Validate(validateNotEmpty),
			huh.NewInput().Title("Neo4j user").Value(&seedOpts.neo4jUser).Validate(validateNotEmpty),
			huh.NewInput().Title("Neo4j password").Value(&seedOpts.neo4jPassword).EchoMode(huh.EchoModePassword),
		)).Run()
		if err != nil {
			return err
		}
	}

	seedOpts.files = files
	return runSeed(cmd, nil)
}

// findJSONDocuments lists candidate document files in ./data and the
// current directory, sorted, deduplicated.
func findJSONDocuments() []string {
	seen := map[string]bool{}
	var files []string
	for _, pattern := range []string{"data/*.json", "*.json"} {
		matches, _ := filepath.Glob(pattern)
		for _, m := range matches {
			if !seen[m] {
				seen[m] = true
				files = append(files, m)
			}
		}
	}
	sort.Strings(files)
	return files
}

func validateNotEmpty(s string) error {
	if strings.TrimSpace(s) == "" {
		return fmt.Errorf("required")
	}
	return nil
}

func validateYear(s string) error {
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil || n < 1970 || n > 2200 {
		return fmt.Errorf("enter a four-digit year")
	}
	return nil
}

func validateISODate(s string) error {
	if _, err := time.Parse(time.DateOnly, strings.TrimSpace(s)); err != nil {
		return fmt.Errorf("use YYYY-MM-DD")
	}
	return nil
}
