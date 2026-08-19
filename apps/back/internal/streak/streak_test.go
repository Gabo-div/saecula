package streak

import (
	"testing"
	"time"
)

func d(s string) time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		panic(err)
	}
	return t
}

func days(ss ...string) []time.Time {
	out := make([]time.Time, len(ss))
	for i, s := range ss {
		out[i] = d(s)
	}
	return out
}

func TestCompute(t *testing.T) {
	cases := []struct {
		name        string
		days        []time.Time
		today       string
		wantCurrent int
		wantBest    int
		wantToday   bool
	}{
		{"empty", days(), "2026-08-18", 0, 0, false},
		{"single today", days("2026-08-18"), "2026-08-18", 1, 1, true},
		{"consecutive three", days("2026-08-16", "2026-08-17", "2026-08-18"), "2026-08-18", 3, 3, true},
		{"grace gap tolerated", days("2026-08-16", "2026-08-17", "2026-08-19"), "2026-08-19", 3, 3, true},
		{"two-day gap breaks", days("2026-08-15", "2026-08-18"), "2026-08-18", 1, 1, true},
		{"alive at grace boundary (last 2 days ago)", days("2026-08-16"), "2026-08-18", 1, 1, false},
		{"broken past grace (last 3 days ago)", days("2026-08-15"), "2026-08-18", 0, 1, false},
		{"best is longest historical run", days("2026-08-01", "2026-08-02", "2026-08-03", "2026-08-10"), "2026-08-18", 0, 3, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := Compute(c.days, d(c.today))
			if got.Current != c.wantCurrent {
				t.Errorf("Current = %d, want %d", got.Current, c.wantCurrent)
			}
			if got.Best != c.wantBest {
				t.Errorf("Best = %d, want %d", got.Best, c.wantBest)
			}
			if got.TodayDone != c.wantToday {
				t.Errorf("TodayDone = %v, want %v", got.TodayDone, c.wantToday)
			}
		})
	}
}

func TestValidActivityType(t *testing.T) {
	for _, ok := range []string{"bible", "readings", "prayer", "catechism"} {
		if !ValidActivityType(ok) {
			t.Errorf("%q should be valid", ok)
		}
	}
	for _, bad := range []string{"", "BIBLE", "walk", "app_open"} {
		if ValidActivityType(bad) {
			t.Errorf("%q should be invalid", bad)
		}
	}
}
