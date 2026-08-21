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

// needsPublish reports whether a is missing a variant URL for any width in
// variantWidths — i.e. whether it still needs (re)publishing.
func needsPublish(a *Asset) bool {
	for _, w := range variantWidths {
		if a.Variants[strconv.Itoa(w)] == "" {
			return true
		}
	}
	return false
}

func writeManifest(path string, assets []Asset) error {
	out, err := json.MarshalIndent(assets, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(out, '\n'), 0o644)
}

// Publish downloads each not-yet-published asset's source, generates every
// variant width, uploads them to R2 under deterministic keys, and writes the
// manifest back to disk immediately after each asset succeeds. Assets that
// already have every variant URL are skipped. Idempotent: same keys
// overwrite. On a per-asset download/upload error, Publish returns the error;
// assets completed in prior iterations are already persisted on disk, so a
// re-run retries only what's missing.
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
		if !needsPublish(a) {
			fmt.Printf("%s: already published, skipping\n", a.ID)
			continue
		}
		if a.Source == "" {
			return fmt.Errorf("%s: source is required to publish", a.ID)
		}
		original, err := download(ctx, a.Source)
		if err != nil {
			return fmt.Errorf("%s: %w", a.ID, err)
		}
		if w, err := imageWidth(original); err != nil {
			return fmt.Errorf("%s: %w", a.ID, err)
		} else if w < maxVariantWidth() {
			return fmt.Errorf("%s: source width %dpx is below the %dpx minimum — "+
				"too small to be background/share-usable without upscaling; use a larger source",
				a.ID, w, maxVariantWidth())
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
		if err := writeManifest(manifestPath, assets); err != nil {
			return fmt.Errorf("%s: write manifest: %w", a.ID, err)
		}
		fmt.Printf("%s: published %d variants\n", a.ID, len(variants))
	}

	return nil
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
