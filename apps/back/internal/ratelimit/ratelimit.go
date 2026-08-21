// Package ratelimit throttles a caller identified by an opaque string key:
// the chat endpoint keys on user ID, the public MCP endpoint on API key ID.
package ratelimit

import (
	"sync"
	"time"
)

// Window is a per-process sliding one-minute window.
//
// ponytail: in-memory only — correct for a single instance; a replicated
// backend needs a shared store (Redis) behind this same Allow method.
type Window struct {
	mu     sync.Mutex
	perMin int
	hits   map[string][]time.Time
}

// New returns a window allowing perMin hits per key per minute. A perMin of
// zero or less disables limiting.
func New(perMin int) *Window {
	return &Window{perMin: perMin, hits: map[string][]time.Time{}}
}

// Allow records a hit for key and reports whether it stays within the limit.
func (w *Window) Allow(key string) bool {
	if w.perMin <= 0 {
		return true
	}
	now := time.Now()
	cutoff := now.Add(-time.Minute)

	w.mu.Lock()
	defer w.mu.Unlock()

	kept := w.hits[key][:0]
	for _, t := range w.hits[key] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= w.perMin {
		w.hits[key] = kept
		return false
	}
	w.hits[key] = append(kept, now)
	return true
}
