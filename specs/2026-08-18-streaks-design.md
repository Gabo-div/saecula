# Rachas (Streaks) — Design

Date: 2026-08-18
Status: Approved for implementation planning

## Goal

Track a user's daily devotional practice and show a motivating streak. A day
counts as "completed" when the user performs any devotional action (reads
Scripture, reads the day's Mass readings, completes a guided prayer, or reads
catechism). A single unified streak; opening the app alone does not count.

## Decisions (locked)

- **Definition:** unified streak, any devotional activity credits the day.
- **Trigger:** explicit client check-in on a concrete devotional action. The app
  posts a check-in; the server never infers activity from other endpoints.
- **Grace:** one missed day tolerated (see algorithm).
- **v1 scope:** current streak, best streak, grace day, history/calendar view.
- **Out of v1:** notifications/reminders — see the separate notifications
  roadmap (`specs/2026-08-18-notifications-roadmap.md`).
- **Storage model:** one row per active day; streaks computed on read (approach A).

## Data model

New migration `apps/back/migrations/007_streaks.sql` (idempotent; migrations are
plain numbered SQL applied by Postgres on first boot — no migration tool):

```sql
CREATE TABLE IF NOT EXISTS activity_days (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day           DATE NOT NULL,
  activity_type TEXT NOT NULL,          -- 'bible' | 'readings' | 'prayer' | 'catechism'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
```

- One row per (user, calendar day). Check-in is an idempotent upsert
  (`ON CONFLICT (user_id, day) DO NOTHING`) — the first activity of the day wins
  and sets `activity_type`.
- `activity_type` is stored but ignored by the unified v1 calculation. It is a
  cheap column that enables per-activity streaks and stats later without a
  re-migration.
- `day` is a `DATE`, supplied by the client as the device's local calendar day
  (`YYYY-MM-DD`). This follows the existing convention (`client.ts` `todayLocalISO()`):
  the client owns "today" so the streak rolls over at the user's own midnight.
  The server stores no user timezone and never computes "today" itself for streaks.
- No denormalized streak counters. ~365 rows/user/year makes on-read computation
  trivial. The `(user_id, day)` PK already indexes the ordered scan.

## Timezone semantics

The only "today" in the system is the device's current local calendar day.
The client sends it (`todayLocalISO()`); the server stores `DATE` values and
never derives a day from its own clock (except the curl/no-`date` fallback,
irrelevant to the app). No user timezone is stored anywhere.

Consequence: the day-rollover (midnight) follows the phone's current timezone.
If the user changes timezone, the cutoff moves with them — "today" is always
where they are now, which is the intended behavior.

Behavior on timezone change (all safe by construction — `DATE` granularity +
1-day grace + idempotent upsert):
- **Travel east** (day shortens; may skip a calendar day near the date line):
  a skipped day is absorbed by the grace day → streak intact.
- **Travel west** (day lengthens; local date may repeat or go back): a repeat
  check-in is a no-op (idempotent upsert); registering an earlier day just fills
  a gap — harmless.
- **Near midnight across a zone**: may credit two adjacent days with little real
  time between — generous, never harmful.

Worst case is being gifted or charged one day of count when crossing the
international date line — imperceptible and always neutral-or-favorable to the
user. Eliminating this entirely would require storing the user's timezone plus
UTC timestamps and recomputing days server-side — more state and complexity for
an edge the grace day already covers. Not done in v1.

## Streak algorithm (grace = 1 missed day)

Given the user's distinct active days as `DATE`s and a client-supplied `today`:

**Current streak** — anchored at today:
1. Let `last` = max active day. If there are no days, current = 0.
2. If `today - last > 2` (measured in whole days) → current = 0 (broken: two or
   more consecutive missed days including possibly today).
3. Otherwise walk active days descending from `last`: `current = 1`; for each
   earlier active day `d`, if `prev - d <= 2` then `current++` and `prev = d`,
   else stop.

**Best streak** — the longest run anywhere in history under the same rule:
walk all active days ascending; a run continues while `next - prev <= 2`,
reset otherwise; track the max run length.

Only active days count toward the number; a tolerated missed day does not add to
the count, it just does not break the chain. A gap of 2+ missed days breaks it.

Worked examples (today = J):
- `L, M, (miss W), J` → current **3** (miss tolerated, does not add).
- `L, (miss), (miss), J` → current **1** (two misses break; only J survives).
- last active = 2 days before today → still alive (grace); 3+ days → broken.

Effectively the user must act at least once every two calendar days to keep the
streak alive.

## Backend

New package `apps/back/internal/streak`, following the existing module plugin
pattern (`server.API`: `Pattern() string` + `Routes() chi.Router`), constructed
in `apps/back/main.go` and appended to `ProtectedAPIs` (mounts under
`/api/streak`, behind `AuthMiddleware`). Structural template: the `chat` module
(per-user, pgxpool-backed, repository + API).

- `repository.go` (pgxpool): `Upsert(ctx, userID, day, activityType)`,
  `Days(ctx, userID, from, to)` returning ordered `(day, activityType)`.
- `service`/handler: the streak algorithm above, operating on the days list.
- User identity via `auth.UserIDFromContext(ctx)`.

Routes (all under `/api`, authed):
- `POST /api/streak/checkin` — body `{ "date": "YYYY-MM-DD", "activityType": "bible" }`
  → upsert, returns the updated streak summary (same shape as GET).
- `GET  /api/streak` — returns `{ current, best, lastActiveDay, todayDone }`.
  `todayDone` compares `lastActiveDay` to the client-supplied `?date=` (local
  today); if `date` is omitted, `todayDone` is computed against server UTC and
  may be stale for the user — the mobile client always passes `date`.
- `GET  /api/streak/history?from=YYYY-MM-DD&to=YYYY-MM-DD` — returns
  `[{ day, activityType }]` for the calendar/heatmap. Bounded range (reject or
  clamp ranges beyond, e.g., 366 days).

## Contracts

Add to `packages/contracts/src/index.ts` only. Mobile's
`apps/mobile/src/types/api.ts` re-exports `@saecula/contracts` (`export * from
'@saecula/contracts'`), so the new types flow through with no second edit.

```ts
export type ActivityType = 'bible' | 'readings' | 'prayer' | 'catechism';

export interface StreakResponse {
  current: number;
  best: number;
  lastActiveDay: string | null; // YYYY-MM-DD
  todayDone: boolean;
}

export interface CheckinRequest {
  date: string;          // YYYY-MM-DD, client local day
  activityType: ActivityType;
}

export interface StreakHistoryEntry {
  day: string;           // YYYY-MM-DD
  activityType: ActivityType;
}
export interface StreakHistoryResponse {
  entries: StreakHistoryEntry[];
}
```

## Mobile

- `src/api/client.ts`: typed wrappers
  - `checkinStreak(activityType)` — sends `todayLocalISO()` + type; returns `StreakResponse`.
  - `fetchStreak()` — passes `?date=todayLocalISO()`.
  - `fetchStreakHistory(from, to)`.
- `src/store/streakStore.ts` (zustand + persist over async-storage; template:
  `readerStore`): caches `{ current, best, todayDone, lastActiveDay }`. Refreshed
  on Home mount. Exposes `checkin(type)` that is a no-op when `todayDone` is
  already true (avoids redundant calls), otherwise fire-and-forget POST then
  update cache from the response.
- **Check-in wiring** — call `streakStore.checkin(type)` on these concrete
  devotional actions:
  - open a Bible chapter (`bible`)
  - open the day's Mass readings (`readings`)
  - complete a guided prayer (`prayer`)
  - open a catechism entry (`catechism`)
- **Home card** (`HomeScreen.tsx`, natural home alongside the daily verse /
  catechism carousel): shows current streak (🔥 N días), best streak, and
  today's state. Tap → `StreakScreen`.
- **`StreakScreen`**: calendar/heatmap of history from `fetchStreakHistory`,
  current + best streak headline. New hidden stack route (pattern: existing
  hidden stacks in `RootTabs.tsx`). No new date library — format dates with the
  same manual `YYYY-MM-DD` helpers already used; a month grid is plain arithmetic.

## Error handling

- Check-in is best-effort from the client (fire-and-forget); a failed check-in
  must never block the devotional action. Log and move on; the next check-in or
  Home refresh reconciles.
- Idempotent upsert means duplicate check-ins on the same day are harmless.
- 401 is already handled globally by the axios interceptor (auto-logout).
- History range is bounded server-side to avoid unbounded scans.

## Testing

Go unit tests (the non-trivial logic), with an injected clock / explicit `today`:
- current streak: consecutive days, single grace gap tolerated, 2+ gap breaks,
  empty history, anchor exactly at grace boundary (2 days), just past it (3 days).
- best streak: longest run detection with interior grace gaps.
- repository upsert idempotency (duplicate check-in same day is a no-op).

No mobile test framework beyond existing; check-in wiring is thin and covered by
the E2E/manual flow.

## Out of scope (v1)

- Notifications / reminders (own roadmap doc).
- Per-activity separate streaks (data model already supports adding later).
- Streak freeze/repair purchases, social/sharing.
