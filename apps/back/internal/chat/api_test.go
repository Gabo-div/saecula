package chat

import (
	"strings"
	"testing"
	"time"
)

func TestTitle(t *testing.T) {
	short := "What is grace?"
	if got := title("  " + short + "  "); got != short {
		t.Fatalf("title(short) = %q, want %q", got, short)
	}
	long := strings.Repeat("a", 100)
	got := title(long)
	if !strings.HasSuffix(got, "…") || len([]rune(got)) != 61 {
		t.Fatalf("title(long) = %q (len %d), want 60 runes + ellipsis", got, len([]rune(got)))
	}
}

func TestRateLimiter(t *testing.T) {
	l := &rateLimiter{perMin: 2, hits: map[string][]time.Time{}}
	if !l.allow("u") || !l.allow("u") {
		t.Fatal("first two requests should be allowed")
	}
	if l.allow("u") {
		t.Fatal("third request within the window should be denied")
	}
	// A different user is independent.
	if !l.allow("other") {
		t.Fatal("a different user should not be limited")
	}
	// perMin <= 0 disables limiting.
	open := &rateLimiter{perMin: 0, hits: map[string][]time.Time{}}
	for i := 0; i < 100; i++ {
		if !open.allow("u") {
			t.Fatal("perMin=0 should never limit")
		}
	}
}
