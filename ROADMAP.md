# Roadmap

Planned work, roughly ordered by dependency, not date. Each item is a sketch —
promote it to a dated design doc in `specs/` before implementing.

---

## 1. Notifications

Daily reminders and prompts (streak, readings, prayer, liturgical calendar,
app news). Local scheduling first (`expo-notifications`), remote push later for
server-initiated content.

Detailed roadmap: [`specs/2026-08-18-notifications-roadmap.md`](specs/2026-08-18-notifications-roadmap.md).

---

## 2. Move images to our own service (off Wikimedia)

**Problem.** Home backgrounds and the daily-verse art are fetched at runtime
straight from Wikimedia Commons (`HomeScreen.tsx` `wikimedia()` +
`daily_features.image_url`). That means hotlinking a third party: no control
over availability, sizing, or licensing display; needs a custom `User-Agent`;
can rate-limit or 404 without warning.

**Goal.** Serve curated art from storage we control, behind stable URLs.

**Approach.**
- Curate the image set once; store originals in object storage (S3 / Cloudflare
  R2 / Supabase Storage) with pre-generated sizes (e.g. 1200w for the hero).
- Serve via a CDN URL or a thin backend redirect; keep licence/attribution
  metadata alongside each asset.
- Populate `daily_features.image_url` (column already exists) with our URLs; the
  mobile client keeps reading `image_url` unchanged.
- Replace the `BACKGROUNDS`/`wikimedia()` fallback in `HomeScreen.tsx` with our
  default asset(s).

**Open questions.** Which storage/CDN; do we need on-the-fly resizing or just
pre-sized variants; how attribution is displayed in-app.

**Status.** Home backgrounds and share images now ship from Cloudflare R2 via
the `image_assets` catalog and `saecula-cli images` (seed/publish). **Remaining:**
the daily/feast-day art is still Wikimedia — it needs the feast images curated
into the manifest and published to R2 (requires R2 credentials), after which
`daily.go` should set `daily_features.image_asset_id` (the backend already
returns `attribution` for linked daily art).

---

## 3. Account verification & password recovery

**Problem.** Auth is register/login only (`internal/auth`, JWT). No email
verification, no way to recover a forgotten password.

**Approach.**
- **Email sending** — pick a provider (SMTP or transactional API) and add a
  small mailer; this is the shared prerequisite for both flows.
- **Verify email.** Add `email_verified` to `users` + a short-lived token
  (signed or a `verification_tokens` row). `POST /auth/verify/request` (resend),
  `GET/POST /auth/verify/confirm`. Decide whether an unverified account is
  limited or just nagged.
- **Reset password.** `POST /auth/password/forgot` (email a token, always 200 to
  avoid account enumeration), `POST /auth/password/reset` (token + new password).
  Invalidate existing sessions on reset.
- **Mobile** — verify-pending banner, "forgot password" screen, reset-token
  deep link (ties into notifications/deep-linking work).

**Open questions.** Email provider; token delivery (deep link vs code entry);
whether verification is mandatory before use.

---

## 4. Friends & shared streaks

**Problem.** Streaks are solo. A social layer (friends, seeing each other's
streaks) is a strong retention driver.

**Approach.**
- **Friendships** — `friendships(requester_id, addressee_id, status,
  created_at)` with `status` pending/accepted/blocked; request / accept /
  remove endpoints in a new `internal/friends` module (follows the existing
  `server.API` pattern).
- **Find friends** — by email or a share link/code; no public directory to start.
- **Shared streak view** — read friends' current/best streak and today's state
  (reuse the streak summary). Consider a "group streak" (everyone active today)
  as a later add-on.
- **Contracts + mobile** — friend list, requests, and a friends section in the
  streak sheet / a dedicated screen.

**Privacy.** Streak visibility is friends-only; requests require acceptance;
support block/remove. Decide what a friend can see (counts only vs which days).

**Open questions.** Invite mechanism (email vs link/code); group-streak rules;
notification hooks (ties into item 1) for friend requests and "a friend kept
their streak".

---

## 5. Concept graph, Timeline & public MCP

**Problem.** The Neo4j concept graph is thin, so graph-backed features are
stubbed: the `graph_related` tool and cross-reference queries have little to
return, and the **Timeline (Explore)** screen — the app's namesake
chronological view over the graph — is still a placeholder (its `/timeline`
endpoint and `fetchTimeline` client already exist).

**Approach.**
- **Populate relationships** — saints ↔ verses, councils ↔ dogmas, etc., so
  `graph_related` and cross-reference queries become useful.
- **Scripture cross-references in the Catechism** — map CCC footnotes to verse
  entity IDs (`(:CatechismParagraph)-[:CITES]->(:Verse)`).
- **Timeline (Explore)** — build the screen on the existing endpoint/client.
- **Public MCP server** — expose the existing Genkit tools (`search_scripture`,
  `get_verses`, `search_catechism`, `get_catechism`, `graph_related`) as a
  public MCP endpoint for external hosts (Claude, etc.).

---

## 6. Original-language texts (Hebrew, Aramaic, Greek)

**Goal.** Add the source-language text alongside the modern translations, so a
verse can be read in its original — Hebrew (OT), Aramaic (the Aramaic portions
of Daniel/Ezra/Jeremiah), and Greek (NT, plus LXX Greek for the deuterocanon).

**Candidate sources (PD / open, structured — no HTML scrape needed).**
- **Hebrew OT** — Westminster Leningrad Codex (openscriptures/morphhb,
  tanach.us); the Aramaic passages live inside it.
- **Greek NT** — Nestle 1904 or Byzantine/Robinson-Pierpont (public domain), or
  SBLGNT (free under its own licence — check terms).
- **Greek OT / deuterocanon** — Swete LXX (public domain); Rahlfs is copyright.

**Alignment.** These use their own versification (esp. Psalms, Sirach, the
Greek additions), so this rides on the same `(code, chapter, verse)` remap
problem flagged for the Vulgata-based texts — expect a per-book mapping layer,
not a drop-in. See [`SOURCES.md`](SOURCES.md) for the current version/license
inventory.

**Open questions.** Right-to-left rendering + Hebrew/Greek fonts in the reader;
whether to show morphology/interlinear or plain text first; storage size.

---

## Content & smaller backlog

- **Santoral detail** — the saints calendar lists days but rows aren't
  tappable; add a saint detail sheet like the celebrations one.
- **More guided prayers** — Stations of the Cross, Divine Mercy, Angelus.
- **Feast art** — extend curated images beyond the current fixed feasts (rides
  on item 2's storage/CDN work).
- **Profile editing** — edit account profile (ties into item 3).

---

## Dependencies

- Items 3 and 4 both want **email/notifications** (item 1) for their best UX
  (verification links, friend-request alerts) — build the mailer/notification
  plumbing early.
- Item 4's friend-request and streak-nudge alerts layer directly on item 1.
- The **Feast art** backlog item depends on item 2's image storage/CDN.
