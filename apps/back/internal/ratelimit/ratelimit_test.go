package ratelimit

import "testing"

func TestWindowLimitsPerKey(t *testing.T) {
	w := New(2)

	first, second := w.Allow("a"), w.Allow("a")
	if !first || !second {
		t.Fatal("first two hits for a key must be allowed")
	}
	if w.Allow("a") {
		t.Error("third hit exceeded the limit but was allowed")
	}
	if !w.Allow("b") {
		t.Error("a different key must have its own budget")
	}
}

func TestWindowDisabled(t *testing.T) {
	w := New(0)
	for i := 0; i < 100; i++ {
		if !w.Allow("a") {
			t.Fatalf("perMin=0 must disable limiting, blocked at hit %d", i)
		}
	}
}
