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
