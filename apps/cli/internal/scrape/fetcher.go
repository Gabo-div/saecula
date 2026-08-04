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

// fetchWithRetry retries transient fetch failures with a growing delay.
func fetchWithRetry(ctx context.Context, f Fetcher, url string, attempts int, delay time.Duration) (body io.ReadCloser, err error) {
	for attempt := 1; attempt <= attempts; attempt++ {
		if attempt > 1 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(time.Duration(attempt-1) * delay):
			}
		}
		if body, err = f.Fetch(ctx, url); err == nil {
			return body, nil
		}
	}
	return nil, fmt.Errorf("after %d attempts: %w", attempts, err)
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
