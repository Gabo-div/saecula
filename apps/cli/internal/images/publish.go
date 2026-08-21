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
