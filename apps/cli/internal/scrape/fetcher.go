// Package scrape turns remote source pages into generic model.Document
// JSON. It never touches a database — persisting a scraped document is the
// seed command's job.
package scrape

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Fetcher retrieves the raw bytes of a source page. Injected so tests can
// feed fixtures and alternative transports (cache, rate limiting, headless
// browser) can be swapped in without touching parsers.
type Fetcher interface {
	Fetch(ctx context.Context, url string) (io.ReadCloser, error)
}

// HTTPFetcher downloads pages over HTTP(S) with a polite User-Agent.
type HTTPFetcher struct {
	client *http.Client
}

var _ Fetcher = (*HTTPFetcher)(nil)

func NewHTTPFetcher(client *http.Client) *HTTPFetcher {
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	return &HTTPFetcher{client: client}
}

func (f *HTTPFetcher) Fetch(ctx context.Context, url string) (io.ReadCloser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "saecula-cli/1.0 (+https://github.com/saecula)")

	resp, err := f.client.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("unexpected status %s", resp.Status)
	}
	return resp.Body, nil
}
