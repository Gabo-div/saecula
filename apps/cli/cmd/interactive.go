package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

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
				huh.NewOption("Scrape the complete CEE Bible into one JSON document", "scrape"),
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
// Scrape wizard — whole Bible, no book/chapter picking
// ---------------------------------------------------------------------------

func interactiveScrape(cmd *cobra.Command) error {
	outPath := scrapeOpts.out
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

	scrapeOpts.out = outPath
	return runScrape(cmd, nil)
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
