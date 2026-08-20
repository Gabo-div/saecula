package cmd

import (
	"errors"
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

Every screen offers a "← Back" option, so you never have to restart the CLI
to change your mind. After an action finishes you return to the main menu
(choose "Quit" or press Ctrl+C to leave).

Running saecula-cli with no arguments in a terminal also starts this mode.`,
	RunE: runInteractive,
}

func init() {
	rootCmd.AddCommand(interactiveCmd)
}

// Select values used purely for wizard navigation. The NUL prefix keeps
// them distinct from anything a user would type or a file would contain.
const (
	backValue = "\x00back" // "← Back" option in selects
	exitValue = "\x00exit" // "Quit" option in the main menu
)

// Wizard navigation sentinels returned by the per-step helpers. runInteractive
// treats them as control flow instead of errors.
var (
	errMenuBack = errors.New("go back to the previous menu")
	errMenuExit = errors.New("quit interactive mode")
)

// newForm builds a huh form using the terminal's own color scheme
// (ThemeBase applies no custom palette, so system colors shine through).
func newForm(groups ...*huh.Group) *huh.Form {
	return huh.NewForm(groups...).WithTheme(huh.ThemeFunc(huh.ThemeBase))
}

// runForm runs a form and maps Ctrl+C (huh.ErrUserAborted) to a clean exit
// instead of an error: quitting the wizard should quit the CLI, not crash it.
func runForm(form *huh.Form) error {
	if err := form.Run(); err != nil {
		if errors.Is(err, huh.ErrUserAborted) {
			return errMenuExit
		}
		return err
	}
	return nil
}

// backOption is the "← Back" entry appended to navigation selects.
func backOption() huh.Option[string] {
	return huh.NewOption("← Back", backValue)
}

// navSelect is a "Continue / ← Back" picker appended after free-form inputs,
// so even the last screen of a wizard can go back without restarting.
func navSelect(title, goLabel string) *huh.Select[string] {
	return huh.NewSelect[string]().
		Title(title).
		Options(
			huh.NewOption(goLabel, "go"),
			backOption(),
		)
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

	for {
		action, err := mainMenu()
		if errors.Is(err, errMenuExit) {
			return nil
		}
		if err != nil {
			return err
		}
		if action == exitValue {
			return nil
		}

		switch action {
		case "scrape":
			err = interactiveScrape(cmd)
		case "seed":
			err = interactiveSeed(cmd)
		default:
			return fmt.Errorf("unhandled action %q", action)
		}

		switch {
		case errors.Is(err, errMenuBack):
			// A wizard bubbled its own back up to the top — show the main
			// menu again.
		case errors.Is(err, errMenuExit):
			return nil
		case err != nil:
			return err
		}
	}
}

// mainMenu is the initial screen. It loops back here after every action.
func mainMenu() (string, error) {
	var action string
	err := runForm(newForm(huh.NewGroup(
		huh.NewSelect[string]().
			Title("Saecula CLI — what do you want to do?").
			Options(
				huh.NewOption("Scrape a source into one JSON document", "scrape"),
				huh.NewOption("Seed JSON documents into PostgreSQL + Neo4j", "seed"),
				huh.NewOption("Quit", exitValue),
			).
			Value(&action),
	)))
	return action, err
}

// ---------------------------------------------------------------------------
// Scrape wizard — pick WHAT to scrape, then WHERE from, then the details
// ---------------------------------------------------------------------------

// scrapeSources lists the available sources per scrape type. Adding a
// source here is all the wizard needs to offer it.
var scrapeSources = map[string][]huh.Option[string]{
	"bible": {
		huh.NewOption("CEE — conferenciaepiscopal.es (Sagrada Biblia 2011, Spanish)", "cee"),
		huh.NewOption("Nova Vulgata — vatican.va (official Latin)", "nova"),
		huh.NewOption("WEB-CE — ebible.org (World English Bible, Catholic Edition)", "web"),
	},
	"readings": {
		huh.NewOption("Vatican News (Spanish, fast, ~2018 → +3 months, no psalm)", "vaticannews"),
		huh.NewOption("USCCB (English, includes psalm, any date)", "usccb"),
	},
	"catechism": {
		huh.NewOption("Vatican — vatican.va (English, paragraphs 1–2865)", "en"),
		huh.NewOption("Vatican — vatican.va (Spanish, paragraphs 1–2865)", "es"),
		huh.NewOption("Vatican — vatican.va (Latin, paragraphs 1–2865)", "la"),
	},
	"citations": {
		huh.NewOption("Catechism — all three editions (es + en + la)", "all"),
		huh.NewOption("Catechism — Spanish (richest inline citations)", "es"),
		huh.NewOption("Catechism — English", "en"),
		huh.NewOption("Catechism — Latin", "la"),
	},
}

func interactiveScrape(cmd *cobra.Command) error {
	for {
		var scrapeType string
		err := runForm(newForm(huh.NewGroup(
			huh.NewSelect[string]().
				Title("What do you want to scrape?").
				Options(
					huh.NewOption("Bible — the complete canon, text included", "bible"),
					huh.NewOption("Daily Mass readings — verse references only", "readings"),
					huh.NewOption("Catechism — numbered paragraphs, text included", "catechism"),
					huh.NewOption("Citations — extract references from the Catechism (es/en/la)", "citations"),
					backOption(),
				).
				Value(&scrapeType),
		)))
		if err != nil {
			return err
		}
		if scrapeType == backValue {
			return errMenuBack
		}

		for {
			var source string
			err := runForm(newForm(huh.NewGroup(
				huh.NewSelect[string]().
					Title("Source").
					Options(append(scrapeSources[scrapeType], backOption())...).
					Value(&source),
			)))
			if err != nil {
				return err
			}
			if source == backValue {
				break // back to the scrape-type menu
			}

			switch scrapeType {
			case "bible":
				bibleOpts.source = source
				bibleOpts.out = ""
				err = interactiveScrapeBible(cmd)
			case "readings":
				readingsOpts.source = source
				err = interactiveScrapeReadings(cmd)
			case "catechism":
				catechismOpts.lang = source
				err = interactiveScrapeCatechism(cmd)
			case "citations":
				if source == "all" {
					citationsOpts.all = true
					citationsOpts.lang = ""
				} else {
					citationsOpts.all = false
					citationsOpts.lang = source
				}
				err = interactiveScrapeCitations(cmd)
			}
			if errors.Is(err, errMenuBack) {
				continue // back to the source menu
			}
			if err != nil {
				return err
			}
			return nil // scrape finished → back to the main menu
		}
	}
}

// askOutputFile prompts for the output path and confirms before running.
// Continue runs the scrape; "← Back" bubbles up to the previous screen.
func askOutputFile(def, goLabel string) (string, error) {
	outPath := def
	var choice string
	err := runForm(newForm(huh.NewGroup(
		huh.NewInput().
			Title("Output file").
			Value(&outPath).
			Validate(validateNotEmpty),
		navSelect("Ready?", goLabel),
	)))
	if err != nil {
		return "", err
	}
	if choice == backValue {
		return "", errMenuBack
	}
	return strings.TrimSpace(outPath), nil
}

func defaultBibleOut() string {
	if bibleOpts.out != "" {
		return bibleOpts.out
	}
	if src, ok := bibleSources[bibleOpts.source]; ok {
		return src.defaultOut
	}
	return "data/bible_cee.json"
}

// ---------------------------------------------------------------------------
// Citations scrape wizard — the Catechism's citation apparatus, merged into
// one catalog. Editions were already picked in the source select.
// ---------------------------------------------------------------------------

func interactiveScrapeCitations(cmd *cobra.Command) error {
	outPath := citationsOpts.out
	if outPath == "" {
		outPath = "data/citations_catechism.json"
	}
	confirmed := true

	err := newForm(huh.NewGroup(
		huh.NewInput().
			Title("Output catalog file").
			Value(&outPath).
			Validate(validateNotEmpty),
		huh.NewConfirm().
			Title("Scrape the Catechism's citations (~100 pages per edition)?").
			Value(&confirmed),
	)).Run()
	if err != nil {
		return err
	}
	if !confirmed {
		return nil
	}

	citationsOpts.out = outPath
	return runScrapeCitations(cmd, nil)
}

// ---------------------------------------------------------------------------
// Bible scrape wizard — whole Bible, no book/chapter picking
// ---------------------------------------------------------------------------

func interactiveScrapeBible(cmd *cobra.Command) error {
	label := "Download the whole Bible"
	if src, ok := bibleSources[bibleOpts.source]; ok {
		label = "Download " + src.label
	}
	outPath, err := askOutputFile(defaultBibleOut(), label)
	if err != nil {
		return err
	}
	bibleOpts.out = outPath
	return runScrapeBible(cmd, nil)
}

// ---------------------------------------------------------------------------
// Catechism scrape wizard — whole Catechism, no section picking
// ---------------------------------------------------------------------------

func defaultCatechismOut() string {
	if catechismOpts.out != "" {
		return catechismOpts.out
	}
	return fmt.Sprintf("data/catechism_ccc_%s.json", catechismOpts.lang)
}

func interactiveScrapeCatechism(cmd *cobra.Command) error {
	outPath, err := askOutputFile(defaultCatechismOut(), "Download the whole Catechism (~100 pages)")
	if err != nil {
		return err
	}
	catechismOpts.out = outPath
	return runScrapeCatechism(cmd, nil)
}

// ---------------------------------------------------------------------------
// Daily readings scrape wizard
// ---------------------------------------------------------------------------

func defaultReadingsOut() string {
	if readingsOpts.out != "" {
		return readingsOpts.out
	}
	return fmt.Sprintf("data/readings_%s.json", readingsOpts.source)
}

func askYear(title string) (int, error) {
	year := fmt.Sprintf("%d", time.Now().Year())
	var choice string
	err := runForm(newForm(huh.NewGroup(
		huh.NewInput().Title(title).Value(&year).Validate(validateYear),
		navSelect("Next", "Continue"),
	)))
	if err != nil {
		return 0, err
	}
	if choice == backValue {
		return 0, errMenuBack
	}
	return strconv.Atoi(strings.TrimSpace(year))
}

func askFromTo() error {
	from, to := "", ""
	var choice string
	err := runForm(newForm(huh.NewGroup(
		huh.NewInput().Title("From (YYYY-MM-DD)").Value(&from).Validate(validateISODate),
		huh.NewInput().Title("To (YYYY-MM-DD)").Value(&to).Validate(validateISODate),
		navSelect("Next", "Continue"),
	)))
	if err != nil {
		return err
	}
	if choice == backValue {
		return errMenuBack
	}
	readingsOpts.from, readingsOpts.to = from, to
	return nil
}

// interactiveScrapeReadings assumes readingsOpts.source was already chosen
// by the scrape wizard.
func interactiveScrapeReadings(cmd *cobra.Command) error {
	for {
		var mode string
		err := runForm(newForm(huh.NewGroup(
			huh.NewSelect[string]().
				Title("Date range").
				Options(
					huh.NewOption("Civil year (Jan 1 – Dec 31)", "year"),
					huh.NewOption("Liturgical year (Advent to Advent)", "liturgical"),
					huh.NewOption("Custom range (from/to)", "custom"),
					backOption(),
				).
				Value(&mode),
		)))
		if err != nil {
			return err
		}
		if mode == backValue {
			return errMenuBack // back to the source menu
		}

		readingsOpts.year, readingsOpts.liturgicalYear = 0, 0
		readingsOpts.from, readingsOpts.to = "", ""
		switch mode {
		case "year", "liturgical":
			title := "Year"
			if mode == "liturgical" {
				title = "Liturgical year"
			}
			year, err := askYear(title)
			if errors.Is(err, errMenuBack) {
				continue // back to the date-range menu
			}
			if err != nil {
				return err
			}
			if mode == "year" {
				readingsOpts.year = year
			} else {
				readingsOpts.liturgicalYear = year
			}
		case "custom":
			if err := askFromTo(); errors.Is(err, errMenuBack) {
				continue
			} else if err != nil {
				return err
			}
		}

		outPath, err := askOutputFile(defaultReadingsOut(), "Download the daily readings (one page per day)")
		if errors.Is(err, errMenuBack) {
			continue // back to the date-range step
		}
		if err != nil {
			return err
		}
		readingsOpts.out = outPath
		return runScrapeReadings(cmd, nil)
	}
}

// ---------------------------------------------------------------------------
// Seed wizard
// ---------------------------------------------------------------------------

// pickDocuments lets the user choose which JSON documents to seed, or type
// a path when none are found nearby. Returns errMenuBack when "← Back" was
// chosen.
func pickDocuments() ([]string, error) {
	candidates := findJSONDocuments()
	if len(candidates) == 0 {
		var path string
		var choice string
		err := runForm(newForm(huh.NewGroup(
			huh.NewInput().
				Title("No *.json documents found nearby — enter a path").
				Value(&path).
				Validate(validateNotEmpty),
			navSelect("Next", "Continue"),
		)))
		if err != nil {
			return nil, err
		}
		if choice == backValue {
			return nil, errMenuBack
		}
		return []string{path}, nil
	}

	options := make([]huh.Option[string], 0, len(candidates)+1)
	for _, f := range candidates {
		options = append(options, huh.NewOption(f, f))
	}
	options = append(options, backOption())

	var files []string
	err := runForm(newForm(huh.NewGroup(
		huh.NewMultiSelect[string]().
			Title("Documents to seed").
			Description("Space to toggle, enter to confirm").
			Options(options...).
			Value(&files).
			Validate(func(selected []string) error {
				if len(selected) == 0 {
					return fmt.Errorf("select at least one file (or toggle \"← Back\" to go back)")
				}
				return nil
			}),
	)))
	if err != nil {
		return nil, err
	}
	for _, f := range files {
		if f == backValue {
			return nil, errMenuBack
		}
	}
	return files, nil
}

func askDefaults() (bool, error) {
	var choice string
	err := runForm(newForm(huh.NewGroup(
		huh.NewSelect[string]().
			Title("Database connections").
			Options(
				huh.NewOption("Use local docker-compose defaults (PostgreSQL + Neo4j)", "defaults"),
				huh.NewOption("Enter connection details manually", "manual"),
				backOption(),
			).
			Value(&choice),
	)))
	if err != nil {
		return false, err
	}
	switch choice {
	case "defaults":
		return true, nil
	case "manual":
		return false, nil
	default:
		return false, errMenuBack
	}
}

// askConnections fills seedOpts' connection fields by hand.
func askConnections() error {
	var choice string
	err := runForm(newForm(huh.NewGroup(
		huh.NewInput().Title("PostgreSQL DSN").Value(&seedOpts.postgresDSN).Validate(validateNotEmpty),
		huh.NewInput().Title("Neo4j Bolt URI").Value(&seedOpts.neo4jURI).Validate(validateNotEmpty),
		huh.NewInput().Title("Neo4j user").Value(&seedOpts.neo4jUser).Validate(validateNotEmpty),
		huh.NewInput().Title("Neo4j password").Value(&seedOpts.neo4jPassword).EchoMode(huh.EchoModePassword),
		navSelect("Connect", "Continue"),
	)))
	if err != nil {
		return err
	}
	if choice == backValue {
		return errMenuBack
	}
	return nil
}

func interactiveSeed(cmd *cobra.Command) error {
docsLoop:
	for {
		files, err := pickDocuments()
		if err != nil {
			return err
		}

		for {
			useDefaults, err := askDefaults()
			if err != nil {
				if errors.Is(err, errMenuBack) {
					continue docsLoop // re-pick the documents
				}
				return err
			}
			if useDefaults {
				break
			}
			err = askConnections()
			if errors.Is(err, errMenuBack) {
				continue // re-ask the defaults question
			}
			if err != nil {
				return err
			}
			break
		}

		seedOpts.files = files
		return runSeed(cmd, nil)
	}
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
