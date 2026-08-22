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
	fill        bool
	date        string
	verse       string
	image       string
	catechism   string
	postgresDSN string
}

// dailyPool is the rotation used to fill ordinary days when --fill is set:
// well-known verses, one per day of the year (wrapping). Feast days from
// --file override their slot. Edit freely — order only affects which verse
// lands on which ordinary day.
var dailyPool = []string{
	"JHN.3.16", "PSA.23.1", "ROM.8.28", "PHP.4.13", "ISA.41.10", "JER.29.11",
	"MAT.6.33", "PRO.3.5", "JOS.1.9", "PSA.46.1", "2CO.5.17", "GAL.2.20",
	"EPH.2.8", "HEB.11.1", "JAS.1.2", "1PE.5.7", "1JN.4.8", "REV.21.4",
	"MAT.11.28", "LUK.1.37", "PSA.27.1", "PSA.91.1", "ROM.12.2", "1CO.13.4",
	"PHP.4.6", "COL.3.23", "PSA.119.105", "MAT.5.9", "JHN.14.6", "JHN.8.12",
	"PSA.34.8", "ISA.40.31", "MIC.6.8", "ZEP.3.17", "PSA.16.11", "ROM.5.8",
	"EPH.6.10", "2TI.1.7", "HEB.12.2", "1PE.2.9", "1JN.1.9", "REV.3.20",
	"ACT.1.8", "PSA.100.5", "PRO.16.3", "MAT.28.19",
}

// catechismPool is the rotation used to give ordinary days a "catechism of
// the day": well-known CCC paragraphs, one per day (wrapping). Feast days
// from --file override their slot with their own catechism.
var catechismPool = []int{
	27, 30, 45, 50, 74, 85, 102, 121, 144, 160,
	172, 195, 210, 222, 240, 257, 262, 271, 289, 295,
	305, 321, 332, 344, 358, 362, 371, 386, 398, 421,
	431, 442, 453, 458, 464, 469, 480, 490, 496, 512,
	526, 533, 540, 552, 561, 576, 581, 599, 618, 654,
}

// dailyEntry is one row of a --file feast list. Date is "MM-DD" (a fixed feast
// applied to --year) or a full "YYYY-MM-DD". Verse is a single reference
// ("JHN.1.14") or a same-chapter range ("LUK.1.46-49"). Image is optional.
// Catechism lists CCC paragraph numbers for the same day ("2077" or "1,2,3").
type dailyEntry struct {
	Date      string `json:"date"`
	Verse     string `json:"verse"`
	Image     string `json:"image,omitempty"`    // legacy: a raw image URL
	ImageID   string `json:"image_id,omitempty"` // preferred: an image_assets catalog id
	Catechism string `json:"catechism,omitempty"`
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
  --date/--verse/--image/--catechism: a single row.

The verse may be one reference ("JHN.1.14") or a same-chapter range
("LUK.1.46-49"). --catechism (or a "catechism" field in the file) lists CCC
paragraph numbers, comma-separated ("2077" or "1,2,3"). Idempotent: re-running
overwrites the same dates.`,
	Example: `  saecula-cli daily --file data/daily_feasts.json --year 2026 --fill
  saecula-cli daily --file data/daily_feasts.json --year 2026
  saecula-cli daily --date 2026-08-06 --verse MAT.17.2 --image https://…
  saecula-cli daily --date 2026-08-06 --verse MAT.17.2 --catechism 2077`,
	RunE: runDaily,
}

func runDaily(cmd *cobra.Command, _ []string) error {
	ctx, cancel := context.WithTimeout(cmd.Context(), time.Minute)
	defer cancel()

	var entries []dailyEntry
	var err error
	if dailyOpts.fill {
		entries, err = fillYear()
	} else {
		entries, err = dailyEntries()
	}
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

	assets, err := loadImageAssets(ctx, pool)
	if err != nil {
		return err
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
		var image, assetID any
		switch {
		case e.ImageID != "":
			url, ok := assets[e.ImageID]
			if !ok {
				return fmt.Errorf("%s: unknown image_id %q (run `saecula-cli images seed` first)", date, e.ImageID)
			}
			image, assetID = url, e.ImageID
		case e.Image != "":
			image = e.Image
		}
		catechismNums, err := parseCatechismArg(e.Catechism)
		if err != nil {
			return fmt.Errorf("%s: %w", date, err)
		}
		var catechism any
		if len(catechismNums) > 0 {
			catechism = catechismNums
		}
		if _, err := pool.Exec(ctx,
			`INSERT INTO daily_features (feature_date, verse_ids, image_url, catechism_numbers, image_asset_id)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (feature_date)
			 DO UPDATE SET verse_ids = EXCLUDED.verse_ids, image_url = EXCLUDED.image_url,
			               catechism_numbers = EXCLUDED.catechism_numbers,
			               image_asset_id = EXCLUDED.image_asset_id`,
			date, ids, image, catechism, assetID); err != nil {
			return fmt.Errorf("upsert %s: %w", date, err)
		}
		fmt.Printf("%s → %s (%d verse(s))%s\n", date, e.Verse, len(ids),
			catechismNote(catechismNums))
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
	return []dailyEntry{{Date: dailyOpts.date, Verse: dailyOpts.verse, Image: dailyOpts.image, Catechism: dailyOpts.catechism}}, nil
}

// parseCatechismArg splits a comma-separated CCC paragraph list ("2077" or
// "1,2,3") into ints; an empty string yields nil (no catechism for the day).
func parseCatechismArg(s string) ([]int, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil
	}
	var nums []int
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		n, err := strconv.Atoi(part)
		if err != nil || n < 1 {
			return nil, fmt.Errorf("bad catechism number %q", part)
		}
		nums = append(nums, n)
	}
	return nums, nil
}

// catechismNote formats a short progress suffix for the console log.
func catechismNote(nums []int) string {
	if len(nums) == 0 {
		return ""
	}
	return fmt.Sprintf(" + CCC %v", nums)
}

// fillYear produces one entry for every day of --year: the feast from --file
// when the date has one, otherwise a rotating pool verse. This materializes a
// whole year so every day has a curated verse (not just feasts).
func fillYear() ([]dailyEntry, error) {
	year := dailyOpts.year
	if year == 0 {
		year = time.Now().UTC().Year()
	}

	feasts := map[string]dailyEntry{}
	if dailyOpts.file != "" {
		raw, err := os.ReadFile(dailyOpts.file)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", dailyOpts.file, err)
		}
		var list []dailyEntry
		if err := json.Unmarshal(raw, &list); err != nil {
			return nil, fmt.Errorf("parse %s: %w", dailyOpts.file, err)
		}
		for _, e := range list {
			d, err := resolveDate(e.Date, year)
			if err != nil {
				return nil, err
			}
			feasts[d] = e
		}
	}

	var entries []dailyEntry
	day := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	for i := 0; day.Year() == year; i++ {
		date := day.Format("2006-01-02")
		if f, ok := feasts[date]; ok {
			f.Date = date
			entries = append(entries, f)
		} else {
			entries = append(entries, dailyEntry{
				Date:      date,
				Verse:     dailyPool[i%len(dailyPool)],
				Catechism: strconv.Itoa(catechismPool[i%len(catechismPool)]),
			})
		}
		day = day.AddDate(0, 0, 1)
	}
	return entries, nil
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
	dailyCmd.Flags().BoolVar(&dailyOpts.fill, "fill", false, "seed every day of --year (feasts from --file, rest from the rotation pool)")
	dailyCmd.Flags().StringVar(&dailyOpts.date, "date", "", "single date YYYY-MM-DD")
	dailyCmd.Flags().StringVar(&dailyOpts.verse, "verse", "", "single verse or range, e.g. LUK.1.46-49")
	dailyCmd.Flags().StringVar(&dailyOpts.image, "image", "", "background image URL (optional)")
	dailyCmd.Flags().StringVar(&dailyOpts.catechism, "catechism", "", "CCC paragraph numbers, comma-separated (optional), e.g. 2077 or 1,2,3")
	dailyCmd.Flags().StringVar(&dailyOpts.postgresDSN, "pg-dsn",
		"postgres://saecula:saecula_dev_password@localhost:5432/saecula?sslmode=disable",
		"PostgreSQL connection string")
	rootCmd.AddCommand(dailyCmd)
}

// loadImageAssets maps each catalog id to its best served URL (1200w hero,
// falling back to 600w), so a feast entry's image_id resolves to an R2 URL.
func loadImageAssets(ctx context.Context, pool *pgxpool.Pool) (map[string]string, error) {
	rows, err := pool.Query(ctx, `SELECT id, COALESCE(variants->>'1200', variants->>'600') FROM image_assets`)
	if err != nil {
		return nil, fmt.Errorf("load image assets: %w", err)
	}
	defer rows.Close()
	m := map[string]string{}
	for rows.Next() {
		var id string
		var url *string
		if err := rows.Scan(&id, &url); err != nil {
			return nil, err
		}
		if url != nil && *url != "" {
			m[id] = *url
		}
	}
	return m, rows.Err()
}
