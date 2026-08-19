// Package streak tracks a user's daily devotional activity and computes a
// streak (current, best, grace day) on read from the stored active days.
package streak

import (
	"math"
	"time"
)

// ActivityType is the kind of devotional action that credits a day. The
// unified streak ignores which one it is; it is stored for future per-activity
// streaks and stats.
type ActivityType string

const (
	Bible     ActivityType = "bible"
	Readings  ActivityType = "readings"
	Prayer    ActivityType = "prayer"
	Catechism ActivityType = "catechism"
)

// ValidActivityType reports whether s is a known activity type.
func ValidActivityType(s string) bool {
	switch ActivityType(s) {
	case Bible, Readings, Prayer, Catechism:
		return true
	}
	return false
}

// grace is the number of missed days tolerated between two credited days.
// Two credited days stay linked when their gap is <= grace+1 calendar days.
const grace = 1

// Summary is the computed streak state returned to clients.
type Summary struct {
	Current       int     `json:"current"`
	Best          int     `json:"best"`
	LastActiveDay *string `json:"lastActiveDay"` // YYYY-MM-DD, null when no activity
	TodayDone     bool    `json:"todayDone"`
}

// Compute derives the streak summary from the user's distinct active days
// (ascending, each a UTC-midnight calendar day) and the client-supplied local
// "today" (also a UTC-midnight day).
func Compute(activeDays []time.Time, today time.Time) Summary {
	if len(activeDays) == 0 {
		return Summary{}
	}
	last := activeDays[len(activeDays)-1]
	lastStr := last.Format("2006-01-02")
	return Summary{
		Current:       computeCurrent(activeDays, today),
		Best:          computeBest(activeDays),
		LastActiveDay: &lastStr,
		TodayDone:     dayDiff(last, today) == 0,
	}
}

func computeCurrent(activeDays []time.Time, today time.Time) int {
	last := activeDays[len(activeDays)-1]
	// Broken when the most recent activity is more than one missed day behind
	// today (a future/same client date yields diff <= 0 -> alive).
	if dayDiff(last, today) > grace+1 {
		return 0
	}
	current := 1
	prev := last
	for i := len(activeDays) - 2; i >= 0; i-- {
		day := activeDays[i]
		if dayDiff(day, prev) <= grace+1 {
			current++
			prev = day
		} else {
			break
		}
	}
	return current
}

func computeBest(activeDays []time.Time) int {
	best, run := 1, 1
	for i := 1; i < len(activeDays); i++ {
		if dayDiff(activeDays[i-1], activeDays[i]) <= grace+1 {
			run++
		} else {
			run = 1
		}
		if run > best {
			best = run
		}
	}
	return best
}

// dayDiff returns whole calendar days from a to b (b-a). Inputs are day-granular
// (UTC midnight), so rounding absorbs any DST/leap-second fuzz.
func dayDiff(a, b time.Time) int {
	return int(math.Round(b.Sub(a).Hours() / 24))
}
