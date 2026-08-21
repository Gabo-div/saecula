# Images Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move home backgrounds, daily-verse art, and the share background off runtime Wikimedia hotlinking onto Cloudflare R2 behind stable URLs, with licence/attribution stored alongside each asset.

**Architecture:** A new `image_assets` Postgres table catalogs each asset (metadata + a `{width: url}` JSONB of R2 variant URLs). A `saecula-cli images` command curates: `publish` (download → resize → upload to R2 → rewrite the committed manifest with URLs) and `seed` (upsert catalog rows from the manifest; strings only, no binaries — this is what local dev runs). A new backend `internal/images` module serves the day's background pick; the existing `bible` daily response gains attribution. Mobile drops the Wikimedia hotlink and the custom `User-Agent`, reads our URLs, and bundles one default hero for offline/first-load.

**Tech Stack:** Go (chi, pgx/v5, sqlc, goose), `golang.org/x/image/draw` (resize), `minio-go` (S3-compatible upload to R2), React Native (Expo, axios), TypeScript contracts.

**Spec:** `specs/2026-08-20-images-service-design.md`

## Global Constraints

- **Storage:** Cloudflare R2, one public bucket. No custom domain yet — `R2_PUBLIC_BASE` is the bucket's `*.r2.dev` URL (dev and prod). Full variant URLs are stored in the DB.
- **Variants:** two pre-generated widths only — `1200` (hero) and `600` (share/thumb). No on-the-fly resize.
- **`license` and `attribution` are `NOT NULL`** — a catalog row without them fails; never ship unattributed art.
- **No saints:** no `subject_kind`/`subject_id` columns. Out of scope.
- **Migrations are forward-only:** `-- +goose Up` only, no `-- +goose Down` (matches 002/006/009). Next number is `010`.
- **Local dev needs no R2 credentials** — it reads public URLs. Only `images publish` (curator) needs `R2_ENDPOINT`, `R2_ACCESS_KEY`, `R2_SECRET`, `R2_BUCKET`, `R2_PUBLIC_BASE`.
- **Idempotency:** R2 keys are deterministic (`PutObject` overwrites); DB upserts key on `id` (`ON CONFLICT (id) DO UPDATE`).
- **New CLI deps:** `github.com/minio/minio-go/v7`, `golang.org/x/image` (follow the existing `golang.org/x/...` convention).

---

### Task 1: Migration 010 + sqlc reads

**Files:**
- Create: `libs/db/migrations/010_image_assets.sql`
- Modify: `libs/db/queries/bible.sql` (extend `DailyFeature`, add `BackgroundImages`)
- Generated: `libs/db/gen/*` (via `sqlc generate` in `libs/db`)

**Interfaces:**
- Produces: table `image_assets(id, title, artist, source_url, license, license_url, attribution, variants JSONB, is_background, is_share, created_at)`; `daily_features.image_asset_id TEXT NULL` FK.
- Produces (sqlc): `gen.BackgroundImages(ctx) ([]gen.BackgroundImagesRow, error)` with fields `ID string, Variants []byte, Attribution string`; extended `gen.DailyFeature(ctx, date) (gen.DailyFeatureRow, error)` now also returning `ImageAssetID *string`, `Attribution *string`, `Variants []byte`.

- [ ] **Step 1: Write the migration**

`libs/db/migrations/010_image_assets.sql`:
```sql
-- +goose Up
-- Curated art served from our own object storage (Cloudflare R2), off runtime
-- Wikimedia hotlinking. One row per asset; the bytes live in R2, the metadata
-- and per-width variant URLs live here. license/attribution are required so no
-- asset is ever served unattributed. Role flags (not a single category) let one
-- image be both a background and a share image.
CREATE TABLE IF NOT EXISTS image_assets (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    artist        TEXT,
    source_url    TEXT,
    license       TEXT NOT NULL,
    license_url   TEXT,
    attribution   TEXT NOT NULL,
    variants      JSONB NOT NULL,
    is_background BOOLEAN NOT NULL DEFAULT false,
    is_share      BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link the day's art to its catalog row so the daily response can carry
-- attribution. Nullable: days seeded before this migration keep working.
ALTER TABLE daily_features
    ADD COLUMN IF NOT EXISTS image_asset_id TEXT REFERENCES image_assets(id);
```

- [ ] **Step 2: Extend the `DailyFeature` query and add `BackgroundImages`**

In `libs/db/queries/bible.sql`, replace the `DailyFeature` query with a LEFT JOIN that also returns the linked asset's attribution + variants, and append a `BackgroundImages` query:
```sql
-- name: DailyFeature :one
SELECT df.verse_ids, df.image_url, df.catechism_numbers,
       df.image_asset_id, ia.attribution, ia.variants
FROM daily_features df
LEFT JOIN image_assets ia ON ia.id = df.image_asset_id
WHERE df.feature_date = $1;

-- name: BackgroundImages :many
SELECT id, variants, attribution
FROM image_assets
WHERE is_background
ORDER BY id;
```

- [ ] **Step 3: Regenerate sqlc and apply the migration**

Run: `cd libs/db && sqlc generate`
Expected: no errors; `libs/db/gen` now has `BackgroundImages`, `BackgroundImagesRow`, and an updated `DailyFeatureRow` with `ImageAssetID *string`, `Attribution *string`, `Variants []byte`.

Run: `bun run migrate`
Expected: migration `010_image_assets` applied.

- [ ] **Step 4: Verify the schema**

Run: `docker exec saecula-postgres psql -U saecula -d saecula -c '\d image_assets' -c '\d daily_features'`
Expected: `image_assets` exists with the columns above; `daily_features` shows `image_asset_id`.

- [ ] **Step 5: Commit**

```bash
git add libs/db/migrations/010_image_assets.sql libs/db/queries/bible.sql libs/db/gen
git commit -m "feat(db): image_assets catalog + daily_features.image_asset_id"
```

---

### Task 2: CLI `images seed` (manifest → catalog rows)

**Files:**
- Create: `apps/cli/internal/images/manifest.go` (manifest model + parse)
- Create: `apps/cli/internal/images/manifest_test.go`
- Create: `apps/cli/internal/images/store.go` (pgx batch upsert)
- Create: `apps/cli/cmd/images.go` (cobra `images` parent + `seed` subcommand)
- Create: `apps/cli/data/images.json` (starter manifest, one entry)

**Interfaces:**
- Produces: `images.Asset` struct; `images.LoadManifest(path string) ([]images.Asset, error)`; `images.UpsertAssets(ctx, pool *pgxpool.Pool, assets []images.Asset) error`.
- Consumes: nothing from earlier tasks except the `image_assets` table (Task 1).

- [ ] **Step 1: Write the failing manifest-parse test**

`apps/cli/internal/images/manifest_test.go`:
```go
package images

import "testing"

func TestLoadManifestRequiresLicenseAndAttribution(t *testing.T) {
	assets, err := parseManifest([]byte(`[
	  {"id":"x","title":"T","license":"Public Domain","attribution":"A, PD",
	   "variants":{"1200":"https://img/x-1200.jpg"},"is_background":true}
	]`))
	if err != nil {
		t.Fatalf("valid manifest: %v", err)
	}
	if len(assets) != 1 || assets[0].ID != "x" || !assets[0].IsBackground {
		t.Fatalf("unexpected parse: %+v", assets)
	}

	if _, err := parseManifest([]byte(`[{"id":"y","title":"T","attribution":"A","variants":{}}]`)); err == nil {
		t.Fatal("expected error: missing license")
	}
	if _, err := parseManifest([]byte(`[{"id":"z","title":"T","license":"PD","variants":{}}]`)); err == nil {
		t.Fatal("expected error: missing attribution")
	}
}
```

- [ ] **Step 2: Run it — verify it fails**

Run: `cd apps/cli && go test ./internal/images/ -run TestLoadManifest -v`
Expected: FAIL — `parseManifest` / `Asset` undefined.

- [ ] **Step 3: Implement the manifest model + parse**

`apps/cli/internal/images/manifest.go`:
```go
// Package images curates art into Cloudflare R2 and its Postgres catalog.
// A committed manifest (apps/cli/data/images.json) is the source of truth;
// `publish` fills each entry's variant URLs, `seed` upserts the catalog rows.
package images

import (
	"encoding/json"
	"fmt"
	"os"
)

// Asset is one manifest entry. `Source` is the origin the curator downloads
// from (publish only); `Variants` is {width: public URL}, filled by publish
// and read by seed.
type Asset struct {
	ID           string            `json:"id"`
	Title        string            `json:"title"`
	Artist       string            `json:"artist,omitempty"`
	Source       string            `json:"source,omitempty"`
	SourceURL    string            `json:"source_url,omitempty"`
	License      string            `json:"license"`
	LicenseURL   string            `json:"license_url,omitempty"`
	Attribution  string            `json:"attribution"`
	Variants     map[string]string `json:"variants"`
	IsBackground bool              `json:"is_background,omitempty"`
	IsShare      bool              `json:"is_share,omitempty"`
}

func parseManifest(data []byte) ([]Asset, error) {
	var assets []Asset
	if err := json.Unmarshal(data, &assets); err != nil {
		return nil, fmt.Errorf("parse manifest: %w", err)
	}
	for i, a := range assets {
		if a.ID == "" {
			return nil, fmt.Errorf("entry %d: id is required", i)
		}
		if a.License == "" {
			return nil, fmt.Errorf("%s: license is required", a.ID)
		}
		if a.Attribution == "" {
			return nil, fmt.Errorf("%s: attribution is required", a.ID)
		}
	}
	return assets, nil
}

// LoadManifest reads and validates the manifest at path.
func LoadManifest(path string) ([]Asset, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return parseManifest(data)
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `cd apps/cli && go test ./internal/images/ -run TestLoadManifest -v`
Expected: PASS.

- [ ] **Step 5: Implement the upsert store**

`apps/cli/internal/images/store.go`:
```go
package images

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UpsertAssets writes catalog rows in one transaction. Idempotent: re-running
// the same manifest updates rows in place (ON CONFLICT (id)). Variants are
// stored as JSONB.
func UpsertAssets(ctx context.Context, pool *pgxpool.Pool, assets []Asset) error {
	if len(assets) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, a := range assets {
		variants, err := json.Marshal(a.Variants)
		if err != nil {
			return fmt.Errorf("%s: marshal variants: %w", a.ID, err)
		}
		batch.Queue(`
			INSERT INTO image_assets
			  (id, title, artist, source_url, license, license_url, attribution,
			   variants, is_background, is_share)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
			ON CONFLICT (id) DO UPDATE SET
			  title=EXCLUDED.title, artist=EXCLUDED.artist, source_url=EXCLUDED.source_url,
			  license=EXCLUDED.license, license_url=EXCLUDED.license_url,
			  attribution=EXCLUDED.attribution, variants=EXCLUDED.variants,
			  is_background=EXCLUDED.is_background, is_share=EXCLUDED.is_share`,
			a.ID, a.Title, nilIfEmpty(a.Artist), nilIfEmpty(a.SourceURL),
			a.License, nilIfEmpty(a.LicenseURL), a.Attribution,
			variants, a.IsBackground, a.IsShare)
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	results := tx.SendBatch(ctx, batch)
	for i := 0; i < batch.Len(); i++ {
		if _, err := results.Exec(); err != nil {
			_ = results.Close()
			return fmt.Errorf("upsert asset %d: %w", i, err)
		}
	}
	if err := results.Close(); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func nilIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}
```

- [ ] **Step 6: Implement the `images` command + `seed` subcommand**

`apps/cli/cmd/images.go`:
```go
package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/spf13/cobra"

	"saecula/cli/internal/images"
)

var imagesSeedOpts struct {
	file        string
	postgresDSN string
}

var imagesCmd = &cobra.Command{
	Use:   "images",
	Short: "Curate art into Cloudflare R2 and its Postgres catalog",
}

var imagesSeedCmd = &cobra.Command{
	Use:   "seed",
	Short: "Upsert image_assets rows from the manifest (no R2 credentials needed)",
	Long: `Loads apps/cli/data/images.json into the image_assets catalog. Only
metadata and the already-published R2 URLs are written — no binaries, no R2
access. This is what local dev runs to reproduce the catalog.`,
	Example: `  saecula-cli images seed --file data/images.json`,
	RunE:    runImagesSeed,
}

func runImagesSeed(cmd *cobra.Command, _ []string) error {
	ctx, cancel := context.WithTimeout(cmd.Context(), time.Minute)
	defer cancel()

	assets, err := images.LoadManifest(imagesSeedOpts.file)
	if err != nil {
		return err
	}
	pool, err := pgxpool.New(ctx, imagesSeedOpts.postgresDSN)
	if err != nil {
		return fmt.Errorf("postgres pool: %w", err)
	}
	defer pool.Close()
	if err := images.UpsertAssets(ctx, pool, assets); err != nil {
		return err
	}
	fmt.Printf("%s: %d image assets upserted\n", imagesSeedOpts.file, len(assets))
	return nil
}

func init() {
	imagesSeedCmd.Flags().StringVar(&imagesSeedOpts.file, "file", "data/images.json", "image manifest JSON")
	imagesSeedCmd.Flags().StringVar(&imagesSeedOpts.postgresDSN, "pg-dsn",
		"postgres://saecula:saecula_dev_password@localhost:5432/saecula?sslmode=disable",
		"PostgreSQL connection string")
	imagesCmd.AddCommand(imagesSeedCmd)
	rootCmd.AddCommand(imagesCmd)
}
```

- [ ] **Step 7: Add the starter manifest**

`apps/cli/data/images.json` (the current Home hero; `variants` filled by `publish` in Task 3):
```json
[
  {
    "id": "velazquez-coronation",
    "title": "Coronation of the Virgin",
    "artist": "Diego Velázquez",
    "source": "https://commons.wikimedia.org/wiki/Special:FilePath/Diego_Vel%C3%A1zquez_-_Coronation_of_the_Virgin_-_Prado.jpg?width=1600",
    "source_url": "https://commons.wikimedia.org/wiki/File:Diego_Vel%C3%A1zquez_-_Coronation_of_the_Virgin_-_Prado.jpg",
    "license": "Public Domain",
    "license_url": "https://creativecommons.org/publicdomain/mark/1.0/",
    "attribution": "Diego Velázquez, Museo del Prado (Public Domain)",
    "variants": {},
    "is_background": true,
    "is_share": true
  }
]
```

- [ ] **Step 8: Build and commit**

Run: `cd apps/cli && go build ./... && go test ./internal/images/ -v`
Expected: build OK, tests PASS.
```bash
git add apps/cli/internal/images/manifest.go apps/cli/internal/images/manifest_test.go apps/cli/internal/images/store.go apps/cli/cmd/images.go apps/cli/data/images.json
git commit -m "feat(cli): images seed — upsert catalog rows from manifest"
```

---

### Task 3: CLI `images publish` (download → resize → upload → rewrite manifest)

**Files:**
- Create: `apps/cli/internal/images/resize.go` (pure resize + key builder)
- Create: `apps/cli/internal/images/resize_test.go`
- Create: `apps/cli/internal/images/publish.go` (download, R2 upload, orchestration)
- Modify: `apps/cli/cmd/images.go` (add `publish` subcommand)
- Modify: `apps/cli/go.mod` (add `minio-go/v7`, `golang.org/x/image`)

**Interfaces:**
- Consumes: `images.Asset`, `images.LoadManifest` (Task 2).
- Produces: `images.variantWidths = []int{1200, 600}`; `images.objectKey(category, slug string, width int) string`; `images.resizeJPEG(src []byte, width int) ([]byte, error)`; `images.Publish(ctx, cfg R2Config, manifestPath string) error` — rewrites the manifest in place with variant URLs.

- [ ] **Step 1: Add dependencies**

Run:
```bash
cd apps/cli
go get github.com/minio/minio-go/v7@latest
go get golang.org/x/image@latest
```
Expected: `go.mod` now requires both; `go mod tidy` clean.

- [ ] **Step 2: Write the failing resize/key test**

`apps/cli/internal/images/resize_test.go`:
```go
package images

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"testing"
)

func sampleJPEG(w, h int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for x := 0; x < w; x++ {
		for y := 0; y < h; y++ {
			img.Set(x, y, color.RGBA{uint8(x % 256), uint8(y % 256), 128, 255})
		}
	}
	var buf bytes.Buffer
	_ = jpeg.Encode(&buf, img, nil)
	return buf.Bytes()
}

func TestResizeJPEGWidth(t *testing.T) {
	out, err := resizeJPEG(sampleJPEG(2000, 1000), 600)
	if err != nil {
		t.Fatal(err)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(out))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Width != 600 {
		t.Fatalf("width = %d, want 600", cfg.Width)
	}
	if cfg.Height != 300 { // aspect preserved
		t.Fatalf("height = %d, want 300", cfg.Height)
	}
}

func TestObjectKey(t *testing.T) {
	if got := objectKey("backgrounds", "velazquez-coronation", 1200); got != "backgrounds/velazquez-coronation-1200.jpg" {
		t.Fatalf("objectKey = %q", got)
	}
}
```

- [ ] **Step 3: Run it — verify it fails**

Run: `cd apps/cli && go test ./internal/images/ -run 'TestResize|TestObjectKey' -v`
Expected: FAIL — `resizeJPEG` / `objectKey` undefined.

- [ ] **Step 4: Implement resize + key builder**

`apps/cli/internal/images/resize.go`:
```go
package images

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"

	"golang.org/x/image/draw"
)

var variantWidths = []int{1200, 600}

// objectKey is the deterministic R2 key for one variant. Deterministic keys
// make PutObject idempotent (same key overwrites, never duplicates).
func objectKey(category, slug string, width int) string {
	return fmt.Sprintf("%s/%s-%d.jpg", category, slug, width)
}

// resizeJPEG decodes a JPEG, scales it to width (aspect preserved) with a
// high-quality CatmullRom kernel, and re-encodes JPEG. No native dependency.
func resizeJPEG(src []byte, width int) ([]byte, error) {
	img, err := jpeg.Decode(bytes.NewReader(src))
	if err != nil {
		return nil, fmt.Errorf("decode jpeg: %w", err)
	}
	b := img.Bounds()
	if b.Dx() == 0 {
		return nil, fmt.Errorf("zero-width source")
	}
	height := b.Dy() * width / b.Dx()
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, b, draw.Over, nil)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 85}); err != nil {
		return nil, fmt.Errorf("encode jpeg: %w", err)
	}
	return buf.Bytes(), nil
}
```

- [ ] **Step 5: Run the test — verify it passes**

Run: `cd apps/cli && go test ./internal/images/ -run 'TestResize|TestObjectKey' -v`
Expected: PASS.

- [ ] **Step 6: Implement publish (download, upload, rewrite manifest)**

`apps/cli/internal/images/publish.go`:
```go
package images

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// R2Config holds the curator-only credentials + public base. All from env.
type R2Config struct {
	Endpoint   string // e.g. <accountid>.r2.cloudflarestorage.com
	AccessKey  string
	Secret     string
	Bucket     string
	PublicBase string // e.g. https://<hash>.r2.dev
}

// category chooses the R2 key prefix from an asset's role flags.
func category(a Asset) string {
	if a.IsBackground {
		return "backgrounds"
	}
	return "daily"
}

// Publish downloads each asset's source, generates every variant width,
// uploads them to R2 under deterministic keys, records the public URLs in the
// asset's Variants, and writes the manifest back. Idempotent: same keys
// overwrite. A per-asset failure leaves that asset's Variants untouched.
func Publish(ctx context.Context, cfg R2Config, manifestPath string) error {
	assets, err := LoadManifest(manifestPath)
	if err != nil {
		return err
	}
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.Secret, ""),
		Secure: true,
	})
	if err != nil {
		return fmt.Errorf("r2 client: %w", err)
	}

	for i := range assets {
		a := &assets[i]
		if a.Source == "" {
			return fmt.Errorf("%s: source is required to publish", a.ID)
		}
		original, err := download(ctx, a.Source)
		if err != nil {
			return fmt.Errorf("%s: %w", a.ID, err)
		}
		variants := map[string]string{}
		for _, w := range variantWidths {
			data, err := resizeJPEG(original, w)
			if err != nil {
				return fmt.Errorf("%s @%d: %w", a.ID, w, err)
			}
			key := objectKey(category(*a), a.ID, w)
			if _, err := client.PutObject(ctx, cfg.Bucket, key,
				bytes.NewReader(data), int64(len(data)),
				minio.PutObjectOptions{ContentType: "image/jpeg"}); err != nil {
				return fmt.Errorf("%s: put %s: %w", a.ID, key, err)
			}
			variants[strconv.Itoa(w)] = cfg.PublicBase + "/" + key
		}
		a.Variants = variants
		fmt.Printf("%s: published %d variants\n", a.ID, len(variants))
	}

	out, err := json.MarshalIndent(assets, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(manifestPath, append(out, '\n'), 0o644)
}

func download(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	// Wikimedia requires a descriptive User-Agent on direct file fetches.
	req.Header.Set("User-Agent", "SaeculaImageCurator/1.0 (contact@saecula.app)")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download %s: status %d", url, resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}
```

- [ ] **Step 7: Add the `publish` subcommand (reads R2 config from env)**

Append to `apps/cli/cmd/images.go`:
```go
var imagesPublishCmd = &cobra.Command{
	Use:   "publish",
	Short: "Download, resize, and upload manifest art to R2, then rewrite the manifest",
	Long: `Curator-only. Needs R2 credentials in the environment:
R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET, R2_BUCKET, R2_PUBLIC_BASE.
Rewrites data/images.json in place with the published variant URLs.`,
	Example: `  saecula-cli images publish --file data/images.json`,
	RunE:    runImagesPublish,
}

func runImagesPublish(cmd *cobra.Command, _ []string) error {
	cfg := images.R2Config{
		Endpoint:   os.Getenv("R2_ENDPOINT"),
		AccessKey:  os.Getenv("R2_ACCESS_KEY"),
		Secret:     os.Getenv("R2_SECRET"),
		Bucket:     os.Getenv("R2_BUCKET"),
		PublicBase: os.Getenv("R2_PUBLIC_BASE"),
	}
	if cfg.Endpoint == "" || cfg.AccessKey == "" || cfg.Secret == "" || cfg.Bucket == "" || cfg.PublicBase == "" {
		return fmt.Errorf("set R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET, R2_BUCKET, R2_PUBLIC_BASE")
	}
	return images.Publish(cmd.Context(), cfg, imagesPublishOpts.file)
}

var imagesPublishOpts struct{ file string }

func init() {
	imagesPublishCmd.Flags().StringVar(&imagesPublishOpts.file, "file", "data/images.json", "image manifest JSON")
	imagesCmd.AddCommand(imagesPublishCmd)
}
```
Add `"os"` to the imports of `apps/cli/cmd/images.go`.

- [ ] **Step 8: Build, test, commit**

Run: `cd apps/cli && go build ./... && go test ./internal/images/ -v`
Expected: build OK, all tests PASS.
```bash
git add apps/cli/internal/images/resize.go apps/cli/internal/images/resize_test.go apps/cli/internal/images/publish.go apps/cli/cmd/images.go apps/cli/go.mod apps/cli/go.sum
git commit -m "feat(cli): images publish — resize + upload to R2"
```

---

### Task 4: Backend `internal/images` module

**Files:**
- Create: `apps/back/internal/images/repository.go`
- Create: `apps/back/internal/images/handler.go`
- Create: `apps/back/internal/images/handler_test.go`
- Modify: `apps/back/main.go` (wire + register)

**Interfaces:**
- Consumes: `gen.BackgroundImages` (Task 1); `httpx.WriteJSON`/`httpx.WriteError`.
- Produces: `images.NewPostgresRepository(pool) *PostgresRepository` implementing `BackgroundRepository`; `images.NewAPI(repo) *API` with `Pattern() == "/images"` and `GET /background` → `{ "url": string, "attribution": string }`.

- [ ] **Step 1: Write the failing handler test**

`apps/back/internal/images/handler_test.go`:
```go
package images

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeRepo struct{ pool []Background }

func (f fakeRepo) Backgrounds(context.Context) ([]Background, error) { return f.pool, nil }

func TestBackgroundReturnsPoolMemberWithAttribution(t *testing.T) {
	repo := fakeRepo{pool: []Background{
		{URL: "https://img/a-1200.jpg", Attribution: "Artist A (PD)"},
		{URL: "https://img/b-1200.jpg", Attribution: "Artist B (PD)"},
	}}
	api := NewAPI(repo)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/background", nil)
	api.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var got struct{ URL, Attribution string }
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.URL == "" || got.Attribution == "" {
		t.Fatalf("empty payload: %+v", got)
	}
}

func TestBackgroundEmptyPoolIs404(t *testing.T) {
	api := NewAPI(fakeRepo{})
	rec := httptest.NewRecorder()
	api.Routes().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/background", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}
```

- [ ] **Step 2: Run it — verify it fails**

Run: `cd apps/back && go test ./internal/images/ -v`
Expected: FAIL — `Background`, `NewAPI` undefined.

- [ ] **Step 3: Implement the handler**

`apps/back/internal/images/handler.go`:
```go
// Package images serves curated art metadata (URL + attribution) from the
// image_assets catalog. Bytes live in R2; this module only hands out URLs.
package images

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"saecula/back/internal/httpx"
)

// Background is one background-pool member: the 1200w URL and its attribution.
type Background struct {
	URL         string `json:"url"`
	Attribution string `json:"attribution"`
}

// BackgroundRepository returns the background-eligible pool.
type BackgroundRepository interface {
	Backgrounds(ctx context.Context) ([]Background, error)
}

type API struct {
	repo BackgroundRepository
	now  func() time.Time
}

func NewAPI(repo BackgroundRepository) *API {
	return &API{repo: repo, now: time.Now}
}

func (a *API) Pattern() string { return "/images" }

func (a *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/background", a.Background)
	return r
}

// Background picks the day's background deterministically by day-of-year, so a
// given date always yields the same image (the rotation the client used to do
// locally, moved server-side).
func (a *API) Background(w http.ResponseWriter, r *http.Request) {
	pool, err := a.repo.Backgrounds(r.Context())
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "load backgrounds")
		return
	}
	if len(pool) == 0 {
		httpx.WriteError(w, http.StatusNotFound, "no backgrounds")
		return
	}
	idx := a.now().UTC().YearDay() % len(pool)
	httpx.WriteJSON(w, http.StatusOK, pool[idx])
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `cd apps/back && go test ./internal/images/ -v`
Expected: PASS (both tests).

- [ ] **Step 5: Implement the repository**

`apps/back/internal/images/repository.go`:
```go
package images

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"

	"saecula/db/gen"
)

type PostgresRepository struct {
	q *gen.Queries
}

var _ BackgroundRepository = (*PostgresRepository)(nil)

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{q: gen.New(pool)}
}

// Backgrounds returns every is_background asset as its 1200w URL + attribution.
// Assets missing a 1200 variant are skipped rather than served broken.
func (r *PostgresRepository) Backgrounds(ctx context.Context) ([]Background, error) {
	rows, err := r.q.BackgroundImages(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Background, 0, len(rows))
	for _, row := range rows {
		var variants map[string]string
		if err := json.Unmarshal(row.Variants, &variants); err != nil {
			continue
		}
		url := variants["1200"]
		if url == "" {
			continue
		}
		out = append(out, Background{URL: url, Attribution: row.Attribution})
	}
	return out, nil
}
```

- [ ] **Step 6: Wire into main.go**

In `apps/back/main.go`: add `"saecula/back/internal/images"` to the import block; construct alongside the other repos/APIs:
```go
	imagesAPI := images.NewAPI(images.NewPostgresRepository(pool))
```
and append `imagesAPI` to `ProtectedAPIs`:
```go
		ProtectedAPIs:  []server.API{timelineAPI, bibleAPI, readingsAPI, calendarAPI, catechismAPI, chatAPI, bookmarksAPI, streakAPI, imagesAPI},
```

- [ ] **Step 7: Build, test, commit**

Run: `cd apps/back && go build ./... && go test ./internal/images/ -v`
Expected: build OK, tests PASS.
```bash
git add apps/back/internal/images apps/back/main.go
git commit -m "feat(back): /api/images/background from image_assets catalog"
```

---

### Task 5: Daily-art attribution (bible module + contracts)

**Files:**
- Modify: `apps/back/internal/bible/handler.go` (`dailyResponse` + populate attribution)
- Modify: `packages/contracts/src/index.ts` (`DailyVerseResponse`)
- Modify: `apps/web/lib/public-types.ts` (diverged `DailyVerseResponse`)

**Interfaces:**
- Consumes: the extended `gen.DailyFeatureRow` (Task 1) — now has `Attribution *string`.
- Produces: `dailyResponse.Attribution string \`json:"attribution,omitempty"\``; contract field `attribution?: string`.

- [ ] **Step 1: Add the field to the daily response struct**

In `apps/back/internal/bible/handler.go`, add to `dailyResponse` (after `ImageURL`):
```go
	Attribution         string               `json:"attribution,omitempty"`
```

- [ ] **Step 2: Populate it from the joined query**

Where `imageURL = f.ImageURL` is set from the `DailyFeature` row, also set attribution when the joined asset is present:
```go
	if f.Attribution != nil {
		attribution = *f.Attribution
	}
```
and include `Attribution: attribution` in the `dailyResponse{...}` literal. (Declare `var attribution string` next to the existing `imageURL` variable.)

- [ ] **Step 3: Verify the backend still builds**

Run: `cd apps/back && go build ./... && go test ./internal/bible/ -v`
Expected: build OK; existing bible tests PASS (the new field defaults empty).

- [ ] **Step 4: Update the shared contract**

In `packages/contracts/src/index.ts`, add to `DailyVerseResponse` (after `image_url`):
```ts
  attribution?: string; // credit for image_url, when the day's art is catalogued
```
And in `apps/web/lib/public-types.ts`, add the same line to its `DailyVerseResponse` (keep the two in sync).

- [ ] **Step 5: Typecheck and commit**

Run: `bun run typecheck`
Expected: passes.
```bash
git add apps/back/internal/bible/handler.go packages/contracts/src/index.ts apps/web/lib/public-types.ts
git commit -m "feat: daily response carries image attribution"
```

---

### Task 6: Mobile — read our URLs, drop Wikimedia, bundle a fallback

**Files:**
- Add: `apps/mobile/assets/default-hero.jpg` (a licensed default hero image — curator supplies the file)
- Modify: `apps/mobile/src/api/client.ts` (add `fetchBackground`)
- Modify: `apps/mobile/src/types/api.ts` re-exports `@saecula/contracts` — add a `BackgroundResponse` type in contracts if not present (Step 1)
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`
- Modify: `apps/mobile/src/screens/ShareScreen.tsx`

**Interfaces:**
- Consumes: `GET /api/images/background` → `{ url, attribution }` (Task 4); `daily.image_url` + `daily.attribution` (Task 5).
- Produces: `fetchBackground(): Promise<BackgroundResponse>`.

- [ ] **Step 1: Add the contract type**

In `packages/contracts/src/index.ts`:
```ts
export interface BackgroundResponse {
  url: string;
  attribution: string;
}
```

- [ ] **Step 2: Add the client call**

In `apps/mobile/src/api/client.ts`:
```ts
export async function fetchBackground(): Promise<BackgroundResponse> {
  const { data } = await api.get<BackgroundResponse>('/api/images/background');
  return data;
}
```
Add `BackgroundResponse` to the `@/types/api` import used in that file.

- [ ] **Step 3: Update HomeScreen — remove Wikimedia, use fetched/bundled background**

In `apps/mobile/src/screens/HomeScreen.tsx`: delete the `wikimedia` helper and the `BACKGROUNDS` array. Add a bundled fallback and fetch the background alongside the daily verse:
```tsx
const DEFAULT_HERO = require('@/../assets/default-hero.jpg');
```
```tsx
  const [bg, setBg] = useState<BackgroundResponse | null>(null);
  // inside load():
  const [verse, cal, background] = await Promise.allSettled([
    fetchDailyVerse(), fetchCalendarDay(), fetchBackground(),
  ]);
  setDaily(verse.status === 'fulfilled' ? verse.value : null);
  setCalDay(cal.status === 'fulfilled' ? cal.value : null);
  setBg(background.status === 'fulfilled' ? background.value : null);
```
Replace the `background` selection + `<Image>` (day's art wins, else fetched pool, else bundled; no `User-Agent` header):
```tsx
  const backgroundUri = daily?.image_url ?? bg?.url;
```
```tsx
      <Image
        source={backgroundUri ? { uri: backgroundUri } : DEFAULT_HERO}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
```
Import `fetchBackground` and `BackgroundResponse`.

- [ ] **Step 4: Update ShareScreen — drop the Wikimedia default + header**

In `apps/mobile/src/screens/ShareScreen.tsx`: delete `DEFAULT_BG` and `BG_HEADERS`. Use the bundled hero as the fallback and prefer the passed-in art:
```tsx
const DEFAULT_HERO = require('@/../assets/default-hero.jpg');
```
In `ShareCard`, render `bgUri ? { uri: bgUri } : DEFAULT_HERO` and remove any `headers: BG_HEADERS` on the `<Image source>`.

- [ ] **Step 5: Typecheck and verify against the running app**

Run: `bun run typecheck`
Expected: passes.

Manual (RN screens have no unit harness in this repo): with Postgres + Memgraph up, `saecula-cli images seed --file data/images.json` run, and the backend running, confirm in the app that the Home hero loads from `img...r2.dev` (or the bundled hero when offline) with no `User-Agent` header, and Share shows the same art. Confirm `curl -s localhost:8080/api/images/background -H "Authorization: Bearer $TOK"` returns `{url, attribution}`.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/HomeScreen.tsx apps/mobile/src/screens/ShareScreen.tsx apps/mobile/src/api/client.ts packages/contracts/src/index.ts apps/mobile/assets/default-hero.jpg
git commit -m "feat(mobile): serve backgrounds from our CDN, drop Wikimedia hotlink"
```

---

### Task 7: Docs + e2e seed wiring

**Files:**
- Modify: `scripts/e2e.sh` (seed the image catalog)
- Modify: `README.md` (image curation + seed section)

**Interfaces:** none produced; ties the pieces into the standard local/e2e flow.

- [ ] **Step 1: Seed images in the e2e pipeline**

In `scripts/e2e.sh`, in the seed block (after the main `seed` call, before `daily`), add:
```bash
  go run . images seed --file data/images.json
```

- [ ] **Step 2: Document the flow in README**

Under "Scrape and seed data", add a short subsection describing:
- `saecula-cli images seed --file data/images.json` — loads the catalog (no R2 creds, what local dev runs).
- `saecula-cli images publish` — curator-only, needs the five `R2_*` env vars, rewrites the manifest with URLs.
- Note that local dev reads the public R2 URLs directly (no MinIO, no binaries in git).

Also replace the README line that says the backend hotlinks Wikimedia backgrounds with the R2-served description.

- [ ] **Step 3: Commit**

```bash
git add scripts/e2e.sh README.md
git commit -m "docs: image curation + seed flow; e2e seeds the catalog"
```

---

## Self-Review

**Spec coverage:**
- R2 storage + deterministic keys → Tasks 3 (`objectKey`, publish). ✓
- `image_assets` table + `daily_features.image_asset_id` → Task 1. ✓
- Role flags, license/attribution NOT NULL, variants JSONB, no saints columns → Task 1. ✓
- `images publish` / `images seed`, committed manifest, seed metadata-only → Tasks 2, 3. ✓
- Resize `x/image/draw`, upload `minio-go`, R2 env config → Task 3. ✓
- `GET /api/images/background` deterministic pick → Task 4. ✓
- Daily attribution via join → Tasks 1, 5. ✓
- Mobile drops Wikimedia + `User-Agent`, bundled fallback, Share updated → Task 6. ✓
- Local dev = public URLs, no creds → Tasks 2, 6 (seed needs no R2). ✓
- Orphan-on-rename ceiling → noted in spec; no `images prune` (YAGNI). ✓

**Deferred (spec "out of scope"), intentionally no task:** saints/Saint entity, on-the-fly resize, MinIO, admin UI, `images prune`, custom domain.

**Type consistency:** `Asset` (CLI) / `Background` + `BackgroundResponse` (backend/contract) used consistently; `objectKey`, `resizeJPEG`, `variantWidths`, `R2Config`, `Publish`, `LoadManifest`, `UpsertAssets` names match across tasks; `gen.DailyFeatureRow.Attribution *string` consumed in Task 5 as defined in Task 1.

**Manual/data steps flagged:** `apps/mobile/assets/default-hero.jpg` (curator supplies a licensed file); the curated image set in `data/images.json` (curator fills); R2 bucket + credentials (one-time setup before `publish`).
