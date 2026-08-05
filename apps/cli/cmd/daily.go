package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/spf13/cobra"
)

var dailyOpts struct {
	file        string
	year        int
	date        string
	verse       string
	image       string
	postgresDSN string
}

// dailyEntry is one row of a --file feast list. Date is "MM-DD" (a fixed feast
// applied to --year) or a full "YYYY-MM-DD". Verse is a single reference
// ("JHN.1.14") or a same-chapter range ("LUK.1.46-49"). Image is optional.
type dailyEntry struct {
	Date  string `json:"date"`
	Verse string `json:"verse"`
	Image string `json:"image,omitempty"`
}

var dailyCmd = &cobra.Command{
	Use:   "daily",
	Short: "Set the curated verse-of-the-day and background image per date",
	Long: `Upserts rows into daily_features (PostgreSQL only). When a date has a
row, the backend serves that verse (or range) and image instead of the
built-in rotation.

Two modes:
  --file: a JSON list of feasts (see data/daily_feasts.json). "MM-DD" dates
          are applied to --year (default: current year).
  --date/--verse/--image: a single row.

The verse may be one reference ("JHN.1.14") or a same-chapter range
("LUK.1.46-49"). Idempotent: re-running overwrites the same dates.`,
	Example: `  saecula-cli daily --file data/daily_feasts.json --year 2026
  saecula-cli daily --date 2026-08-06 --verse MAT.17.2 --image https://…`,
	RunE: runDaily,
}

func runDaily(cmd *cobra.Command, _ []string) error {
	ctx, cancel := context.WithTimeout(cmd.Context(), time.Minute)
	defer cancel()

	entries, err := dailyEntries()
	if err != nil {
		return err
	}

	pool, err := pgxpool.New(ctx, dailyOpts.postgresDSN)
	if err != nil {
		return fmt.Errorf("postgres pool: %w", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("postgres ping: %w", err)
	}

	for _, e := range entries {
		date, err := resolveDate(e.Date, dailyOpts.year)
		if err != nil {
			return err
		}
		ids, err := expandVerseArg(e.Verse)
		if err != nil {
			return fmt.Errorf("%s: %w", date, err)
		}
		var image any
		if e.Image != "" {
			image = e.Image
		}
		if _, err := pool.Exec(ctx,
			`INSERT INTO daily_features (feature_date, verse_ids, image_url)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (feature_date)
			 DO UPDATE SET verse_ids = EXCLUDED.verse_ids, image_url = EXCLUDED.image_url`,
			date, ids, image); err != nil {
			return fmt.Errorf("upsert %s: %w", date, err)
		}
		fmt.Printf("%s → %s (%d verse(s))\n", date, e.Verse, len(ids))
	}
	fmt.Printf("done: %d daily features\n", len(entries))
	return nil
}

// dailyEntries resolves the two input modes into a common list.
func dailyEntries() ([]dailyEntry, error) {
	if dailyOpts.file != "" {
		raw, err := os.ReadFile(dailyOpts.file)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", dailyOpts.file, err)
		}
		var entries []dailyEntry
		if err := json.Unmarshal(raw, &entries); err != nil {
			return nil, fmt.Errorf("parse %s: %w", dailyOpts.file, err)
		}
		return entries, nil
	}
	if dailyOpts.date == "" || dailyOpts.verse == "" {
		return nil, fmt.Errorf("provide --file, or both --date and --verse")
	}
	return []dailyEntry{{Date: dailyOpts.date, Verse: dailyOpts.verse, Image: dailyOpts.image}}, nil
}

// resolveDate turns "MM-DD" into "<year>-MM-DD"; a full "YYYY-MM-DD" passes
// through. It validates the result is a real date.
func resolveDate(date string, year int) (string, error) {
	switch len(date) {
	case 5: // MM-DD
		if year == 0 {
			year = time.Now().UTC().Year()
		}
		date = fmt.Sprintf("%04d-%s", year, date)
	case 10: // YYYY-MM-DD
	default:
		return "", fmt.Errorf("bad date %q (want MM-DD or YYYY-MM-DD)", date)
	}
	if _, err := time.Parse("2006-01-02", date); err != nil {
		return "", fmt.Errorf("bad date %q: %w", date, err)
	}
	return date, nil
}

// expandVerseArg turns "JHN.1.14" into ["JHN.1.14"] and "LUK.1.46-49" into
// the contiguous list ["LUK.1.46", …, "LUK.1.49"]. Ranges are single-chapter.
func expandVerseArg(s string) ([]string, error) {
	i := strings.LastIndexByte(s, '.')
	if i < 0 {
		return nil, fmt.Errorf("bad verse %q", s)
	}
	prefix, last := s[:i], s[i+1:] // "LUK.1", "46-49"

	if dash := strings.IndexByte(last, '-'); dash >= 0 {
		start, err1 := strconv.Atoi(last[:dash])
		end, err2 := strconv.Atoi(last[dash+1:])
		if err1 != nil || err2 != nil || start < 1 || end < start {
			return nil, fmt.Errorf("bad range %q", s)
		}
		ids := make([]string, 0, end-start+1)
		for v := start; v <= end; v++ {
			ids = append(ids, fmt.Sprintf("%s.%d", prefix, v))
		}
		return ids, nil
	}

	if _, err := strconv.Atoi(last); err != nil {
		return nil, fmt.Errorf("bad verse %q", s)
	}
	return []string{s}, nil
}

func init() {
	dailyCmd.Flags().StringVar(&dailyOpts.file, "file", "", "JSON feast list (MM-DD or YYYY-MM-DD entries)")
	dailyCmd.Flags().IntVar(&dailyOpts.year, "year", 0, "year for MM-DD entries (default: current)")
	dailyCmd.Flags().StringVar(&dailyOpts.date, "date", "", "single date YYYY-MM-DD")
	dailyCmd.Flags().StringVar(&dailyOpts.verse, "verse", "", "single verse or range, e.g. LUK.1.46-49")
	dailyCmd.Flags().StringVar(&dailyOpts.image, "image", "", "background image URL (optional)")
	dailyCmd.Flags().StringVar(&dailyOpts.postgresDSN, "pg-dsn",
		"postgres://saecula:saecula_dev_password@localhost:5432/saecula?sslmode=disable",
		"PostgreSQL connection string")
	rootCmd.AddCommand(dailyCmd)
}
