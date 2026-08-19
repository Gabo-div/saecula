# Streaks (Rachas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track daily devotional activity and show the user a motivating streak (current, best, grace day, history calendar).

**Architecture:** One Postgres row per (user, calendar day). Streaks are computed on read from the ordered day list — no denormalized counters. The mobile client owns "today" (device local date) and posts an explicit check-in when the user performs a devotional action; the server never infers activity or a timezone.

**Tech Stack:** Go (chi router, pgx v5), Postgres (plain numbered SQL migrations), TypeScript contracts (`@saecula/contracts`), React Native / Expo mobile (axios, zustand + persist, Tamagui UI).

**Spec:** `specs/2026-08-18-streaks-design.md` (read it — the plan implements it).

## Global Constraints

- Backend module pattern: implement `server.API` (`Pattern() string` + `Routes() chi.Router`); construct in `apps/back/main.go` and append to `ProtectedAPIs`. No router edits.
- User identity: `auth.UserIDFromContext(ctx) (string, bool)`. Handlers 401 when absent.
- HTTP helpers: `httpx.WriteJSON`, `httpx.WriteError`, `httpx.DecodeJSON` (strict, disallows unknown fields).
- Dates on the wire are `YYYY-MM-DD` strings; the client sends its local day (`todayLocalISO()`). Server stores `DATE`, never computes the user's "today" from its own clock (a no-`date` fallback to UTC exists only for curl/tests).
- Migrations: plain numbered `.sql` in `apps/back/migrations`, applied once by Postgres on first boot. Use idempotent DDL. Next number is `007`.
- Grace = 1 missed day tolerated: two credited days stay linked when their gap is ≤ 2 calendar days; a gap ≥ 3 breaks the streak. Missed days never add to the count.
- Contract types live only in `packages/contracts/src/index.ts`; mobile re-exports them via `apps/mobile/src/types/api.ts` (`export * from '@saecula/contracts'`).
- Go tests run via `cd apps/back && go test ./...` (the algorithm tests need no DB; the docker-dependent integration suite skips quietly when Postgres/Neo4j are unreachable).

---

### Task 1: DB migration + streak types & pure algorithm

The testable core. Pure functions, no DB — full TDD here.

**Files:**
- Create: `apps/back/migrations/007_streaks.sql`
- Create: `apps/back/internal/streak/streak.go`
- Test: `apps/back/internal/streak/streak_test.go`

**Interfaces:**
- Produces: `streak.ActivityType` (string enum), `streak.Summary{Current int, Best int, LastActiveDay *string, TodayDone bool}`, `streak.Compute(days []time.Time, today time.Time) Summary`, `streak.ValidActivityType(s string) bool`.

- [ ] **Step 1: Write the migration**

Create `apps/back/migrations/007_streaks.sql`:

```sql
-- One row per (user, calendar day) with any devotional activity. Streaks are
-- computed on read from these rows; no denormalized counters. activity_type is
-- the first activity of the day (unified streak ignores it; kept for future
-- per-activity streaks/stats).
CREATE TABLE IF NOT EXISTS activity_days (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day           DATE NOT NULL,
  activity_type TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
```

- [ ] **Step 2: Write the failing test**

Create `apps/back/internal/streak/streak_test.go`:

```go
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/back && go test ./internal/streak/`
Expected: FAIL — `undefined: Compute` / `undefined: ValidActivityType`.

- [ ] **Step 4: Write the implementation**

Create `apps/back/internal/streak/streak.go`:

```go
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/back && go test ./internal/streak/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/back/migrations/007_streaks.sql apps/back/internal/streak/streak.go apps/back/internal/streak/streak_test.go
git commit -m "feat(streak): add activity_days migration and streak algorithm"
```

---

### Task 2: Postgres repository

**Files:**
- Create: `apps/back/internal/streak/repository.go`

**Interfaces:**
- Consumes: `streak.ActivityType` (Task 1).
- Produces:
  - `streak.HistoryEntry{Day string, ActivityType string}` (Day is `YYYY-MM-DD`).
  - `streak.Repository` interface:
    - `Upsert(ctx context.Context, userID, day, activityType string) error`
    - `ActiveDays(ctx context.Context, userID string) ([]time.Time, error)` (ascending)
    - `History(ctx context.Context, userID, from, to string) ([]HistoryEntry, error)` (ascending)
  - `streak.NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository`

- [ ] **Step 1: Write the implementation**

Create `apps/back/internal/streak/repository.go` (mirrors `internal/chat/repository.go` structure):

```go
package streak

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// HistoryEntry is one credited day, for the calendar/heatmap view.
type HistoryEntry struct {
	Day          string `json:"day"` // YYYY-MM-DD
	ActivityType string `json:"activityType"`
}

// Repository persists activity days scoped to their owner.
type Repository interface {
	// Upsert credits a day; duplicate check-ins on the same day are a no-op
	// (the first activity_type of the day is kept).
	Upsert(ctx context.Context, userID, day, activityType string) error
	// ActiveDays returns the user's distinct active days, ascending.
	ActiveDays(ctx context.Context, userID string) ([]time.Time, error)
	// History returns credited days in [from, to] inclusive, ascending.
	History(ctx context.Context, userID, from, to string) ([]HistoryEntry, error)
}

type PostgresRepository struct {
	pool *pgxpool.Pool
}

var _ Repository = (*PostgresRepository)(nil)

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (r *PostgresRepository) Upsert(ctx context.Context, userID, day, activityType string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO activity_days (user_id, day, activity_type)
		 VALUES ($1, $2::date, $3)
		 ON CONFLICT (user_id, day) DO NOTHING`,
		userID, day, activityType)
	return err
}

func (r *PostgresRepository) ActiveDays(ctx context.Context, userID string) ([]time.Time, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT day FROM activity_days WHERE user_id = $1 ORDER BY day`,
		userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []time.Time{}
	for rows.Next() {
		var day time.Time
		if err := rows.Scan(&day); err != nil {
			return nil, err
		}
		out = append(out, day)
	}
	return out, rows.Err()
}

func (r *PostgresRepository) History(ctx context.Context, userID, from, to string) ([]HistoryEntry, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT to_char(day, 'YYYY-MM-DD'), activity_type
		 FROM activity_days
		 WHERE user_id = $1 AND day BETWEEN $2::date AND $3::date
		 ORDER BY day`,
		userID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []HistoryEntry{}
	for rows.Next() {
		var e HistoryEntry
		if err := rows.Scan(&e.Day, &e.ActivityType); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/back && go build ./internal/streak/`
Expected: no output (success). (DB behavior is exercised by the integration test in Task 3.)

- [ ] **Step 3: Commit**

```bash
git add apps/back/internal/streak/repository.go
git commit -m "feat(streak): add postgres repository"
```

---

### Task 3: HTTP API + wire into server

**Files:**
- Create: `apps/back/internal/streak/api.go`
- Modify: `apps/back/main.go` (services/APIs region, ~lines 80-115)
- Modify: `apps/back/integration_test.go` (wiring + a smoke test)

**Interfaces:**
- Consumes: `streak.Repository`, `streak.Compute`, `streak.ValidActivityType`, `streak.Summary`, `streak.HistoryEntry` (Tasks 1-2); `auth.UserIDFromContext`; `httpx.*`.
- Produces: `streak.NewAPI(repo Repository) *API` implementing `server.API`. Routes under `/api/streak`:
  - `POST /api/streak/checkin` body `{ "date": "YYYY-MM-DD", "activityType": "bible" }` → `Summary`.
  - `GET  /api/streak?date=YYYY-MM-DD` → `Summary`.
  - `GET  /api/streak/history?from=YYYY-MM-DD&to=YYYY-MM-DD` → `{ "entries": [...] }`.

- [ ] **Step 1: Write the API handler**

Create `apps/back/internal/streak/api.go`:

```go
package streak

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"saecula/back/internal/auth"
	"saecula/back/internal/httpx"
)

const dateLayout = "2006-01-02"

// maxHistoryDays bounds a history query to keep the scan small.
const maxHistoryDays = 366

// API serves the streak endpoints (per-user, JWT-protected).
type API struct {
	repo Repository
	now  func() time.Time // injected clock; only the no-date fallback uses it
}

func NewAPI(repo Repository) *API {
	return &API{repo: repo, now: time.Now}
}

func (a *API) Pattern() string { return "/streak" }

func (a *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/checkin", a.Checkin)
	r.Get("/", a.Get)
	r.Get("/history", a.History)
	return r
}

type checkinRequest struct {
	Date         string `json:"date"`
	ActivityType string `json:"activityType"`
}

func (a *API) Checkin(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	var req checkinRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	today, err := time.Parse(dateLayout, req.Date)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "date must be YYYY-MM-DD")
		return
	}
	if !ValidActivityType(req.ActivityType) {
		httpx.WriteError(w, http.StatusBadRequest, "unknown activityType")
		return
	}
	if err := a.repo.Upsert(r.Context(), userID, req.Date, req.ActivityType); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "check-in failed")
		return
	}
	a.writeSummary(w, r, userID, today)
}

func (a *API) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	today := a.now().UTC()
	if q := r.URL.Query().Get("date"); q != "" {
		parsed, err := time.Parse(dateLayout, q)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "date must be YYYY-MM-DD")
			return
		}
		today = parsed
	}
	a.writeSummary(w, r, userID, today)
}

func (a *API) writeSummary(w http.ResponseWriter, r *http.Request, userID string, today time.Time) {
	days, err := a.repo.ActiveDays(r.Context(), userID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "load streak failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, Compute(days, today))
}

func (a *API) History(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	from, err := time.Parse(dateLayout, r.URL.Query().Get("from"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "from must be YYYY-MM-DD")
		return
	}
	to, err := time.Parse(dateLayout, r.URL.Query().Get("to"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "to must be YYYY-MM-DD")
		return
	}
	if to.Before(from) || to.Sub(from) > maxHistoryDays*24*time.Hour {
		httpx.WriteError(w, http.StatusBadRequest, "range must be ordered and within a year")
		return
	}
	entries, err := a.repo.History(r.Context(), userID, from.Format(dateLayout), to.Format(dateLayout))
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "load history failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"entries": entries})
}
```

- [ ] **Step 2: Wire into main.go**

In `apps/back/main.go`, add the import `"saecula/back/internal/streak"` (with the other internal imports), then in the `--- Services and repositories ---` / `--- APIs ---` region construct the API:

```go
	streakAPI := streak.NewAPI(streak.NewPostgresRepository(pool))
```

and append `streakAPI` to the `ProtectedAPIs` slice in the `server.New(server.Config{...})` call:

```go
		ProtectedAPIs:  []server.API{timelineAPI, bibleAPI, readingsAPI, calendarAPI, catechismAPI, chatAPI, streakAPI},
```

- [ ] **Step 3: Add integration wiring + smoke test**

In `apps/back/integration_test.go`: add `"saecula/back/internal/streak"` to the imports, construct `streakAPI := streak.NewAPI(streak.NewPostgresRepository(pool))` in `TestMain` next to the other APIs, and append `streakAPI` to the `ProtectedAPIs` slice there too.

Then add this test (it uses the suite's existing helpers for auth'd requests — follow the pattern already in the file for registering a user and calling protected endpoints; adapt names to the helpers present):

```go
func TestStreakCheckinAndGet(t *testing.T) {
	// Register a fresh user and get a bearer token using the suite's existing
	// helper(s), then:
	//   POST /api/streak/checkin {"date":"2026-08-18","activityType":"bible"}
	//   POST /api/streak/checkin {"date":"2026-08-18","activityType":"prayer"} (idempotent: still one day)
	//   GET  /api/streak?date=2026-08-18
	// Assert the GET returns current == 1, best == 1, todayDone == true,
	// lastActiveDay == "2026-08-18".
}
```

Fill the body using the file's existing request helpers (e.g. the same auth+JSON POST/GET helpers the other protected-endpoint tests use). Keep the assertions above.

- [ ] **Step 4: Run tests**

Run: `cd apps/back && go test ./...`
Expected: `internal/streak` PASS; integration test PASS if the docker stack is up, else the suite skips quietly (both acceptable).

- [ ] **Step 5: Commit**

```bash
git add apps/back/internal/streak/api.go apps/back/main.go apps/back/integration_test.go
git commit -m "feat(streak): expose /api/streak checkin, summary, history"
```

---

### Task 4: Shared contract types

**Files:**
- Modify: `packages/contracts/src/index.ts` (append)

**Interfaces:**
- Produces (TS): `ActivityType`, `StreakResponse`, `CheckinRequest`, `StreakHistoryEntry`, `StreakHistoryResponse`. These mirror the Go JSON tags from Task 3 exactly.

- [ ] **Step 1: Append the types**

Add to the end of `packages/contracts/src/index.ts`:

```ts
// --- Streaks ---------------------------------------------------------------
export type ActivityType = 'bible' | 'readings' | 'prayer' | 'catechism';

export interface StreakResponse {
  current: number;
  best: number;
  lastActiveDay: string | null; // YYYY-MM-DD
  todayDone: boolean;
}

export interface CheckinRequest {
  date: string; // YYYY-MM-DD, client local day
  activityType: ActivityType;
}

export interface StreakHistoryEntry {
  day: string; // YYYY-MM-DD
  activityType: ActivityType;
}

export interface StreakHistoryResponse {
  entries: StreakHistoryEntry[];
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && bun run typecheck` (mobile consumes the contract via `@/types/api`; this confirms the new exports resolve).
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/src/index.ts
git commit -m "feat(contracts): add streak types"
```

---

### Task 5: Mobile API client + streak store + check-in wiring

**Files:**
- Modify: `apps/mobile/src/api/client.ts` (export `todayLocalISO`; add three wrappers)
- Create: `apps/mobile/src/store/streakStore.ts`
- Modify: `apps/mobile/src/screens/BibleScreen.tsx` (check-in on chapter load)
- Modify: `apps/mobile/src/screens/DailyReadingsScreen.tsx` (check-in on readings load)
- Modify: `apps/mobile/src/screens/CatechismScreen.tsx` (check-in on catechism load)
- Modify: `apps/mobile/src/screens/GuidedPrayerScreen.tsx` (check-in on finish)

**Interfaces:**
- Consumes: contract types (Task 4).
- Produces:
  - `client.ts`: `export function todayLocalISO(): string`; `checkinStreak(activityType: ActivityType): Promise<StreakResponse>`; `fetchStreak(): Promise<StreakResponse>`; `fetchStreakHistory(from: string, to: string): Promise<StreakHistoryResponse>`.
  - `streakStore.ts`: `useStreakStore` with state `{ current, best, todayDone, lastActiveDay }` and actions `refresh(): Promise<void>`, `checkin(type: ActivityType): void`.

**Note on import direction (avoid a cycle):** `streakStore` imports the wrappers from `@/api/client`; `client.ts` must NOT import `streakStore`. Check-ins are fired from the screens (which already import stores), never from inside `client.ts`.

- [ ] **Step 1: Export `todayLocalISO` and add wrappers in `client.ts`**

Change the existing private `todayLocalISO` declaration to an export:

```ts
// todayLocalISO formats the device's local date as YYYY-MM-DD, so "today"
// rolls over at the user's own midnight rather than the server's UTC one.
export function todayLocalISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
```

Add these imports to the type import block: `ActivityType, StreakResponse, StreakHistoryResponse`. Then add the wrappers (near the other wrappers):

```ts
// --- Streaks ----------------------------------------------------------------

export async function checkinStreak(activityType: ActivityType): Promise<StreakResponse> {
  const { data } = await api.post<StreakResponse>('/api/streak/checkin', {
    date: todayLocalISO(),
    activityType,
  });
  return data;
}

export async function fetchStreak(): Promise<StreakResponse> {
  const { data } = await api.get<StreakResponse>('/api/streak', {
    params: { date: todayLocalISO() },
  });
  return data;
}

export async function fetchStreakHistory(
  from: string,
  to: string,
): Promise<StreakHistoryResponse> {
  const { data } = await api.get<StreakHistoryResponse>('/api/streak/history', {
    params: { from, to },
  });
  return data;
}
```

- [ ] **Step 2: Create the streak store**

Create `apps/mobile/src/store/streakStore.ts` (persist pattern copied from `readerStore.ts`):

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { checkinStreak, fetchStreak } from '@/api/client';
import type { ActivityType } from '@/types/api';

interface StreakState {
  current: number;
  best: number;
  todayDone: boolean;
  lastActiveDay: string | null;
  // refresh pulls the latest summary; errors are swallowed (best-effort).
  refresh: () => Promise<void>;
  // checkin credits today for the given activity. No-op when today is already
  // done. Fire-and-forget: a failure never blocks the devotional action.
  checkin: (type: ActivityType) => void;
}

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      current: 0,
      best: 0,
      todayDone: false,
      lastActiveDay: null,

      refresh: async () => {
        try {
          const s = await fetchStreak();
          set({
            current: s.current,
            best: s.best,
            todayDone: s.todayDone,
            lastActiveDay: s.lastActiveDay,
          });
        } catch {
          // best-effort; keep cached values
        }
      },

      checkin: (type) => {
        if (get().todayDone) return;
        checkinStreak(type)
          .then((s) =>
            set({
              current: s.current,
              best: s.best,
              todayDone: s.todayDone,
              lastActiveDay: s.lastActiveDay,
            }),
          )
          .catch(() => {
            // best-effort; the next check-in or Home refresh reconciles
          });
      },
    }),
    {
      name: 'saecula-streak',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        current: s.current,
        best: s.best,
        todayDone: s.todayDone,
        lastActiveDay: s.lastActiveDay,
      }),
    },
  ),
);
```

- [ ] **Step 3: Wire check-ins into the four screens**

In each screen, import the store (`import { useStreakStore } from '@/store/streakStore';`) and call `useStreakStore.getState().checkin(TYPE)` at the point the user has actually engaged the content — right after the content load succeeds (or, for the guided prayer, when it finishes). The store's `todayDone` guard makes repeat calls free, so placing it in the success path of the existing data effect is fine.

- `BibleScreen.tsx`: after `fetchChapter(...)` resolves successfully → `checkin('bible')`.
- `DailyReadingsScreen.tsx`: after `fetchDailyReadings(...)` resolves successfully → `checkin('readings')`.
- `CatechismScreen.tsx`: after the catechism paragraphs load successfully → `checkin('catechism')`.
- `GuidedPrayerScreen.tsx`: in the `advance()` path where the prayer reaches the finished state (the branch that shows `t('prayers.finished')`, ~line 275) → `checkin('prayer')`.

Example (Bible), inside the existing effect after state is set:

```ts
useStreakStore.getState().checkin('bible');
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/api/client.ts apps/mobile/src/store/streakStore.ts apps/mobile/src/screens/BibleScreen.tsx apps/mobile/src/screens/DailyReadingsScreen.tsx apps/mobile/src/screens/CatechismScreen.tsx apps/mobile/src/screens/GuidedPrayerScreen.tsx
git commit -m "feat(mobile): streak store, api wrappers, and check-in wiring"
```

---

### Task 6: Home streak card + Streak screen + navigation

**Files:**
- Create: `apps/mobile/src/screens/StreakScreen.tsx`
- Modify: `apps/mobile/src/navigation/RootTabs.tsx` (register `Streak` as a hidden tab; add to `RootTabParamList` + `TAB_ICONS`)
- Modify: `apps/mobile/src/screens/HomeScreen.tsx` (streak card + refresh on mount + navigate)

**Interfaces:**
- Consumes: `useStreakStore` (Task 5), `fetchStreakHistory`, `todayLocalISO` (Task 5).
- Produces: `StreakScreen` component; `Streak: undefined` route on `RootTabParamList`.

- [ ] **Step 1: Register the route in `RootTabs.tsx`**

Add `Streak: undefined;` to `RootTabParamList`. Add `Streak: 'fire'` to the `TAB_ICONS` record. Import `StreakScreen`. Add a hidden `Tab.Screen` (same options pattern as the `Profile` hidden tab):

```tsx
      <Tab.Screen
        name="Streak"
        component={StreakScreen}
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
```

- [ ] **Step 2: Create `StreakScreen.tsx`**

Create `apps/mobile/src/screens/StreakScreen.tsx`. It shows current + best streak from the store and a simple month grid of the last ~35 days built from `fetchStreakHistory`. No date library — use plain `Date` arithmetic and the `YYYY-MM-DD` helper. Follow the Tamagui + theme patterns used in `HomeScreen.tsx` (`useAppTheme`, `YStack`, `Text`, `View`). Minimal, self-contained:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { Text, View, XStack, YStack } from 'tamagui';

import { fetchStreakHistory, todayLocalISO } from '@/api/client';
import { useAppTheme } from '@/store/themeStore';
import { useStreakStore } from '@/store/streakStore';

const WINDOW_DAYS = 35;

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function StreakScreen() {
  const c = useAppTheme();
  const { current, best } = useStreakStore();
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchStreakHistory(isoDaysAgo(WINDOW_DAYS - 1), todayLocalISO())
      .then((r) => setDone(new Set(r.entries.map((e) => e.day))))
      .catch(() => {});
  }, []);

  const cells = useMemo(
    () => Array.from({ length: WINDOW_DAYS }, (_, i) => isoDaysAgo(WINDOW_DAYS - 1 - i)),
    [],
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }}>
      <YStack p="$4" gap="$4">
        <XStack gap="$6">
          <YStack>
            <Text color={c.fg} fontSize={32} fontWeight="700">
              🔥 {current}
            </Text>
            <Text color={c.muted} fontSize={12}>
              racha actual
            </Text>
          </YStack>
          <YStack>
            <Text color={c.fg} fontSize={32} fontWeight="700">
              {best}
            </Text>
            <Text color={c.muted} fontSize={12}>
              mejor racha
            </Text>
          </YStack>
        </XStack>

        <XStack flexWrap="wrap" gap="$2">
          {cells.map((iso) => (
            <View
              key={iso}
              width={36}
              height={36}
              rounded="$4"
              bg={done.has(iso) ? c.accent : c.card}
            />
          ))}
        </XStack>
      </YStack>
    </ScrollView>
  );
}
```

Note: use whatever theme token names `HomeScreen.tsx` uses (`c.fg`/`c.onCard`/`c.muted`/`c.accent`/`c.card`/`c.bg`); adjust the names above to match the actual `useAppTheme()` shape if any differ.

- [ ] **Step 3: Add the Home card**

In `apps/mobile/src/screens/HomeScreen.tsx`:

1. Import the store and add a mount refresh alongside the existing daily-data effect:

```ts
import { useStreakStore } from '@/store/streakStore';
```

Inside the component, subscribe and refresh on mount:

```ts
const { current, best, todayDone } = useStreakStore();
useEffect(() => {
  useStreakStore.getState().refresh();
}, []);
```

2. Render a tappable streak card near the top of the scroll content (above or beside the daily carousel; follow the existing celebration-card styling around lines 313-336). Tapping navigates to the Streak screen:

```tsx
<YStack
  mx="$4"
  mt="$3"
  p="$4"
  rounded="$8"
  bg={c.card}
  onPress={() => navigation.navigate('Streak')}
>
  <Text color={c.onCard} fontSize={11} letterSpacing={2} fontWeight="700">
    {t('home.streak').toUpperCase()}
  </Text>
  <Text color={c.onCard} fontSize={22} fontWeight="700">
    🔥 {current} {current === 1 ? 'día' : 'días'}
  </Text>
  <Text color={c.onCard} fontSize={11} opacity={0.75}>
    {todayDone ? 'Hoy completado' : 'Aún no hoy'} · Mejor: {best}
  </Text>
</YStack>
```

3. Add the i18n key `home.streak` (value `"Racha"`) to the locale files the app already uses (search for an existing key like `home.dailyVerse` and add `home.streak` in the same files). If the app has no such structure, use the literal string `'Racha'` instead of `t('home.streak')`.

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/StreakScreen.tsx apps/mobile/src/navigation/RootTabs.tsx apps/mobile/src/screens/HomeScreen.tsx
git commit -m "feat(mobile): streak card on Home and Streak history screen"
```

---

## Self-Review

**Spec coverage:**
- Data model / migration → Task 1. ✓
- Timezone semantics (client-supplied local day) → wire format enforced across Tasks 3 (server parses client date, UTC fallback) & 5 (`todayLocalISO`). ✓
- Streak algorithm (grace, current, best) → Task 1 with the spec's worked examples as test cases. ✓
- Backend module + routes (checkin/get/history) → Tasks 2-3. ✓
- Contracts → Task 4. ✓
- Mobile client + store + check-in triggers (bible/readings/prayer/catechism) → Task 5. ✓
- Home card + history/calendar view → Task 6. ✓
- Testing (algorithm unit tests, upsert idempotency, injected clock) → Task 1 (algorithm) + Task 3 (integration idempotency smoke). ✓
- Out of scope (notifications, per-activity streaks) → not built; notifications tracked in `specs/2026-08-18-notifications-roadmap.md`. ✓

**Type consistency:** `Summary`/`StreakResponse` fields (`current`, `best`, `lastActiveDay`, `todayDone`) match between Go JSON tags (Task 1/3) and TS (Task 4). `checkinRequest`/`CheckinRequest` (`date`, `activityType`) match. `HistoryEntry`/`StreakHistoryEntry` (`day`, `activityType`) match; history endpoint wraps them as `{entries: [...]}` = `StreakHistoryResponse`. Store actions (`refresh`, `checkin`) referenced consistently in Tasks 5-6.

**Placeholder scan:** The integration test body (Task 3 Step 3) is described rather than fully written because it must reuse the suite's existing auth/request helpers, whose exact names live in `integration_test.go`; the required calls and assertions are spelled out. The theme-token and i18n-key notes in Task 6 flag real per-repo variance with a concrete fallback. No other placeholders.
