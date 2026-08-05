package cmd

import (
	"strings"
	"testing"
)

func TestExpandVerseArg(t *testing.T) {
	cases := []struct {
		in   string
		want []string
		err  bool
	}{
		{"JHN.1.14", []string{"JHN.1.14"}, false},
		{"LUK.1.46-49", []string{"LUK.1.46", "LUK.1.47", "LUK.1.48", "LUK.1.49"}, false},
		{"1CO.13.4-4", []string{"1CO.13.4"}, false},
		{"JHN.3.18-16", nil, true}, // reversed
		{"JHN.3.x", nil, true},
		{"nope", nil, true},
	}
	for _, c := range cases {
		got, err := expandVerseArg(c.in)
		if c.err {
			if err == nil {
				t.Errorf("%s: want error, got %v", c.in, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("%s: unexpected error %v", c.in, err)
			continue
		}
		if strings.Join(got, ",") != strings.Join(c.want, ",") {
			t.Errorf("%s = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestResolveDate(t *testing.T) {
	got, err := resolveDate("08-15", 2026)
	if err != nil || got != "2026-08-15" {
		t.Fatalf("MM-DD = %q, %v", got, err)
	}
	if got, err := resolveDate("2026-12-25", 0); err != nil || got != "2026-12-25" {
		t.Fatalf("full = %q, %v", got, err)
	}
	if _, err := resolveDate("2026-02-30", 0); err == nil {
		t.Fatal("want error for impossible date")
	}
	if _, err := resolveDate("13-99", 2026); err == nil {
		t.Fatal("want error for bad MM-DD")
	}
}
