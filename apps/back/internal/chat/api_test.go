package chat

import (
	"strings"
	"testing"
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
