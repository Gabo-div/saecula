# Notifications — Roadmap

Date: 2026-08-18
Status: Roadmap (not scheduled). Not part of streaks v1.

General notifications subsystem for the mobile app. Streak reminders are one
use case among several; this doc scopes the whole capability so it is built once,
not per-feature.

## Use cases

1. **Streak reminder** — "no rompas tu racha": remind before the grace window
   closes if the user has not done a devotional action today.
2. **Daily readings** — the day's Mass readings are available.
3. **Prayer prompt** — a chosen prayer time (e.g., morning/evening, Angelus).
4. **Liturgical calendar** — upcoming solemnity / feast / saint of the day.
5. **App news** — occasional product announcements.

## Two delivery mechanisms

- **Local notifications** (scheduled on-device via `expo-notifications`): best for
  fixed daily times and the streak reminder — no server, no push token, works
  offline, respects the user's local clock (same "day owned by client" model the
  streak already uses). Recommended first mechanism; covers cases 1–3.
- **Remote push** (server-initiated, Expo Push / APNs+FCM): needed for content the
  device cannot know locally in time (calendar changes, app news) and cross-device
  fan-out. Requires a push-token store and a server sender. Defer until a case
  actually needs server-initiated delivery (cases 4–5).

## Building blocks (in rough order)

1. **Dependency:** add `expo-notifications` (not currently installed). Config
   plugin in `app.json`, iOS/Android permission strings.
2. **Permission flow:** request at a meaningful moment (not cold on first launch);
   handle denied/undetermined; a Settings entry to re-enable. Store granted state.
3. **Preferences store** (`zustand` + persist, like existing stores): per-type
   opt-in and per-type time where relevant (e.g., prayer time, streak reminder
   time). One source of truth the scheduler reads.
4. **Local scheduler:** on preference change / app open, cancel + re-schedule the
   user's enabled local notifications for the next window. Keep it declarative
   (compute desired set → diff against scheduled) to avoid duplicates.
5. **Streak reminder logic:** schedule for later today only if `todayDone` is
   false; cancel immediately when a check-in flips `todayDone` true.
6. **Remote push (later):** backend `device_tokens` table (user_id, token,
   platform), register/unregister endpoints, an Expo Push sender, and a trigger
   source (cron/liturgical calendar) for cases 4–5.

## Open questions (resolve when scheduled)

- Default-on vs default-off per type; how aggressive is acceptable.
- Quiet hours / max frequency caps.
- Whether streak reminders need server push at all, or local is sufficient
  (local is sufficient if the app is opened often enough to reschedule).
- Deep-linking: tapping a notification lands on the relevant screen.

## Dependencies / constraints

- `expo-notifications` requires a development build or EAS build for full push;
  local notifications work in more contexts but push tokens do not work in Expo Go.
  Confirm against the current Expo Go / dev-build E2E setup before committing.
- No user timezone is stored server-side today; local scheduling sidesteps this,
  remote push for time-of-day content would need to solve it.
