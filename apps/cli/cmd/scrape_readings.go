package cmd

import (
	"context"
	"fmt"
	"os"
	"sort"
	"time"

	"github.com/spf13/cobra"

	"saecula/cli/internal/model"
	"saecula/cli/internal/scrape"
)

var readingsOpts struct {
	source         string
	out            string
	year           int
	liturgicalYear int
	from           string
	to             string
	bible          string
}

// readingsScraper is what both daily-readings sources implement.
type readingsScraper interface {
	ScrapeReadings(ctx context.Context, from, to time.Time, skip map[string]bool, progress func(string)) (*model.Document, error)
}

var scrapeReadingsCmd = &cobra.Command{
	Use:   "readings",
	Short: "Download daily Mass readings (verse references only) into one JSON document",
	Long: `Downloads the daily Mass readings (one page per date) and writes ONE
JSON document holding every day in the range with the verse REFERENCES of
each reading — no text. References are normalized to per-verse universal
IDs (e.g. WIS.12.13) using the shared catalog (libs/canon), so they match
the entity IDs produced by the bible scrapers.

Sources (--source):
  vaticannews (default): vaticannews.va in Spanish. Fast and reliable.
                         Carries reading 1, reading 2 (when the day has
                         one) and the gospel — NO responsorial psalm (the
                         site does not publish it).
                         Archive: ~2018 through ~3 months ahead.
  usccb                : bible.usccb.org in English. Also carries the
                         responsorial psalm, and any future date. Behind a
                         proof-of-work bot wall that the scraper solves
                         automatically. US calendar. The gospel acclamation
                         (Alleluia) is skipped.

The range is, in order of precedence:
  --from/--to        : explicit ISO dates
  --liturgical-year N: 1st Sunday of Advent of N-1 through the eve of the
                       next Advent
  --year N           : civil year, Jan 1 – Dec 31
  (none)             : the current civil year

Cross-chapter citations ("Genesis 1:1—2:2") need per-chapter verse counts;
they are read from an already-scraped bible document (--bible). Without it
those readings keep their raw reference with empty verse_ids.

Failed days are skipped and reported. Re-running with the same --out keeps
the days already downloaded and retries only the missing ones.`,
	Example: `  saecula-cli scrape readings
  saecula-cli scrape readings --year 2026
  saecula-cli scrape readings --liturgical-year 2026
  saecula-cli scrape readings --source usccb --from 2026-07-01 --to 2026-07-31`,
	RunE: runScrapeReadings,
}

func runScrapeReadings(cmd *cobra.Command, _ []string) error {
	from, to, err := resolveReadingsRange()
	if err != nil {
		return err
	}

	lengths := loadChapterLengths(readingsOpts.bible)

	var scraper readingsScraper
	switch readingsOpts.source {
	case "vaticannews":
		scraper = scrape.NewVaticanNewsScraper(scrape.NewHTTPFetcher(nil), lengths)
	case "usccb":
		// nil fetcher → ObolusFetcher, which clears the site's PoW bot wall.
		scraper = scrape.NewUSCCBScraper(nil, lengths)
	default:
		return fmt.Errorf("unknown --source %q (vaticannews | usccb)", readingsOpts.source)
	}
	if readingsOpts.out == "" {
		readingsOpts.out = fmt.Sprintf("data/readings_%s.json", readingsOpts.source)
	}

	// Resume support: days already in the output file are not re-fetched,
	// so re-running after failures only retries what is missing.
	existing, skip := loadExistingDays(readingsOpts.out)
	if len(skip) > 0 {
		fmt.Printf("%s already holds %d days — they will be kept, not re-fetched\n", readingsOpts.out, len(skip))
	}

	days := int(to.Sub(from).Hours()/24) + 1
	fmt.Printf("Scraping %s daily readings %s → %s (%d pages, be patient)…\n",
		readingsOpts.source, from.Format(time.DateOnly), to.Format(time.DateOnly), days)

	doc, err := scraper.ScrapeReadings(cmd.Context(), from, to, skip, func(line string) {
		fmt.Println("  " + line)
	})
	if err != nil {
		return err
	}

	doc.Days = mergeDays(existing, doc.Days)
	if err := doc.SaveJSON(readingsOpts.out); err != nil {
		return fmt.Errorf("write %s: %w", readingsOpts.out, err)
	}

	readings, unresolved := 0, 0
	for _, d := range doc.Days {
		for _, r := range d.Readings {
			readings++
			if len(r.VerseIDs) == 0 {
				unresolved++
			}
		}
	}
	fmt.Printf("\nDone: %d days, %d readings (%d unresolved references) → %s\n",
		len(doc.Days), readings, unresolved, readingsOpts.out)
	fmt.Printf("Seed it with: saecula-cli seed --file %s\n", readingsOpts.out)
	return nil
}

// resolveReadingsRange applies the precedence documented on the command.
func resolveReadingsRange() (time.Time, time.Time, error) {
	explicit := readingsOpts.from != "" || readingsOpts.to != ""
	if explicit && (readingsOpts.from == "" || readingsOpts.to == "") {
		return time.Time{}, time.Time{}, fmt.Errorf("--from and --to must be given together")
	}
	set := 0
	for _, on := range []bool{explicit, readingsOpts.liturgicalYear != 0, readingsOpts.year != 0} {
		if on {
			set++
		}
	}
	if set > 1 {
		return time.Time{}, time.Time{}, fmt.Errorf("--from/--to, --liturgical-year and --year are mutually exclusive")
	}

	switch {
	case explicit:
		from, err := time.Parse(time.DateOnly, readingsOpts.from)
		if err != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("--from: %w", err)
		}
		to, err := time.Parse(time.DateOnly, readingsOpts.to)
		if err != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("--to: %w", err)
		}
		return from, to, nil
	case readingsOpts.liturgicalYear != 0:
		from := adventStart(readingsOpts.liturgicalYear)
		to := adventStart(readingsOpts.liturgicalYear+1).AddDate(0, 0, -1)
		return from, to, nil
	default:
		year := readingsOpts.year
		if year == 0 {
			year = time.Now().Year()
		}
		return time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC),
			time.Date(year, 12, 31, 0, 0, 0, 0, time.UTC), nil
	}
}

// adventStart returns the 1st Sunday of Advent that OPENS liturgical year N
// (it falls in civil year N-1): three weeks before the last Sunday strictly
// before Christmas.
func adventStart(liturgicalYear int) time.Time {
	christmas := time.Date(liturgicalYear-1, 12, 25, 0, 0, 0, 0, time.UTC)
	daysBack := int(christmas.Weekday())
	if daysBack == 0 {
		daysBack = 7
	}
	advent4 := christmas.AddDate(0, 0, -daysBack)
	return advent4.AddDate(0, 0, -21)
}

// loadExistingDays reads a previous daily_readings output file so a re-run
// can resume it. A missing or non-readings file just means a fresh start.
func loadExistingDays(path string) ([]model.DayReadings, map[string]bool) {
	doc, err := model.LoadJSON(path)
	if err != nil || doc.Type != model.TypeDailyReadings {
		return nil, nil
	}
	skip := make(map[string]bool, len(doc.Days))
	for _, d := range doc.Days {
		skip[d.Date] = true
	}
	return doc.Days, skip
}

// mergeDays combines kept and freshly scraped days, sorted by date.
func mergeDays(existing, scraped []model.DayReadings) []model.DayReadings {
	merged := append(existing, scraped...)
	sort.Slice(merged, func(i, j int) bool { return merged[i].Date < merged[j].Date })
	return merged
}

// loadChapterLengths loads the verse-count table from a scraped bible
// document. Optional: a missing file only disables cross-chapter expansion.
func loadChapterLengths(path string) scrape.ChapterLengths {
	if path == "" {
		return nil
	}
	if _, err := os.Stat(path); err != nil {
		fmt.Printf("note: %s not found — cross-chapter citations will keep raw references only\n", path)
		return nil
	}
	doc, err := model.LoadJSON(path)
	if err != nil || doc.Type != model.TypeBible {
		fmt.Printf("note: %s is not a usable bible document — cross-chapter citations will keep raw references only\n", path)
		return nil
	}
	return scrape.ChapterLengthsFromBible(doc)
}

func init() {
	flags := scrapeReadingsCmd.Flags()
	flags.StringVar(&readingsOpts.source, "source", "vaticannews", "readings source: vaticannews | usccb")
	flags.StringVar(&readingsOpts.out, "out", "", "output JSON file (default data/readings_<source>.json)")
	flags.IntVar(&readingsOpts.year, "year", 0, "civil year to scrape (default: current year)")
	flags.IntVar(&readingsOpts.liturgicalYear, "liturgical-year", 0, "liturgical year to scrape (Advent to Advent)")
	flags.StringVar(&readingsOpts.from, "from", "", "range start, ISO date (requires --to)")
	flags.StringVar(&readingsOpts.to, "to", "", "range end, ISO date (requires --from)")
	flags.StringVar(&readingsOpts.bible, "bible", "data/bible_cee.json", "scraped bible document used to expand cross-chapter citations")
	scrapeCmd.AddCommand(scrapeReadingsCmd)
}
