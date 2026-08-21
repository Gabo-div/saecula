# Images Service (off Wikimedia) — Design

Date: 2026-08-20
Status: Approved for implementation planning

Implements roadmap item 2 (`ROADMAP.md`). Moves home backgrounds, daily-verse
art, and the share background off runtime Wikimedia hotlinking onto storage we
control, behind stable CDN URLs, with licence/attribution held alongside each
asset.

## Goal

Serve curated art from our own object storage + CDN. Stop hotlinking Wikimedia
at runtime (no control over availability, sizing, licensing display; needs a
custom `User-Agent`; can rate-limit or 404). Keep the mobile client's
`image_url` contract working, and surface attribution in-app.

## Decisions (locked)

- **Storage/CDN:** Cloudflare R2 (S3-compatible, free egress, custom domain +
  CDN, no server). One public bucket.
- **Scope now:** backgrounds + daily-verse art + share background. Saints
  profile images are **out of scope** here — saints are not modelled yet
  (they live only inline in `calendar.*.json`); that rides on roadmap item 5.
  No speculative columns for them (add when the Saint entity lands).
- **Local dev:** points at the same public R2 URLs as prod. No MinIO, no image
  binaries in git, no R2 credentials needed to run locally.
- **Seeding:** seed metadata rows, not bytes. A committed manifest
  (`apps/cli/data/images.json`) makes the local catalog reproducible.
- **Variants:** pre-generated sizes (1200w hero, 600w share/thumb). No
  on-the-fly resizing.

## Storage layout (R2)

One public bucket `saecula-images`. No custom domain yet, so the bucket's
public `*.r2.dev` URL is `R2_PUBLIC_BASE` everywhere (dev and prod) for now;
swap in a custom domain (`img.saecula.app`) later by changing that one env var
and re-running `images publish` to rewrite the stored URLs. Object key is
deterministic — `<category>/<slug>-<width>.<ext>`:

```
backgrounds/velazquez-coronation-1200.jpg
backgrounds/velazquez-coronation-600.jpg
daily/nativity-1200.jpg
```

Deterministic keys make `publish` idempotent: `PutObject` on an existing key
overwrites the same object — re-running never creates duplicates (same
guarantee as Memgraph `MERGE`).

**Known ceiling:** renaming an asset's slug orphans its old keys in R2 (the
previous objects are not deleted). Harmless (just storage). Not handled now; a
future `images prune` (delete R2 keys with no `image_assets` row) can reclaim
it — YAGNI until it matters.

## Data model

New goose migration `libs/db/migrations/010_image_assets.sql`:

```sql
CREATE TABLE IF NOT EXISTS image_assets (
  id            TEXT PRIMARY KEY,          -- slug, e.g. 'velazquez-coronation'
  title         TEXT NOT NULL,
  artist        TEXT,
  source_url    TEXT,                       -- origin page (Wikimedia)
  license       TEXT NOT NULL,              -- 'Public Domain', 'CC-BY-SA-4.0'
  license_url   TEXT,
  attribution   TEXT NOT NULL,              -- display string, in-app
  variants      JSONB NOT NULL,             -- {"1200":"https://img.../x-1200.jpg","600":"..."}
  is_background BOOLEAN NOT NULL DEFAULT false,  -- eligible for home/background pool
  is_share      BOOLEAN NOT NULL DEFAULT false,  -- eligible for share
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE daily_features ADD COLUMN IF NOT EXISTS image_asset_id TEXT
  REFERENCES image_assets(id);
```

- Boolean role flags (not a single `category`): one image can be both a
  background and a share image, and the two pools have different aspect-ratio
  needs. Query the pool with `WHERE is_background` / `WHERE is_share`.
- `license` and `attribution` are `NOT NULL` — a seed row without licence data
  fails. Legal correctness is not a corner we cut.
- `variants` is `JSONB` (`{width: url}`) so adding a size later needs no
  migration. Full URLs are stored (already include the public base), so the
  reader concatenates nothing.
- `daily_features.image_url` stays — mobile reads it unchanged. The new
  nullable `image_asset_id` links the day's art to its catalog row so the
  `daily` response can carry attribution. Daily seed sets `image_url` from the
  linked asset's `variants['1200']`.
- **No `subject_kind`/`subject_id`.** Dropped as speculative; saints get their
  own columns/link when that entity exists.

## Curation & seed pipeline (CLI)

Follows the repo's existing split (scrape produces JSON; seed loads JSON into
the DB). Committed manifest `apps/cli/data/images.json`:

```json
[
  {
    "id": "velazquez-coronation",
    "title": "Coronation of the Virgin",
    "artist": "Diego Velázquez",
    "source": "https://commons.wikimedia.org/wiki/Special:FilePath/Diego_Vel%C3%A1zquez_-_Coronation_of_the_Virgin_-_Prado.jpg",
    "license": "Public Domain",
    "license_url": "https://...",
    "attribution": "Diego Velázquez, Museo del Prado (Public Domain)",
    "is_background": true,
    "is_share": true,
    "variants": {}
  }
]
```

Two subcommands under `saecula-cli images`:

- **`images publish`** (curator, run once per curation change; needs R2
  credentials). For each manifest entry: download the `source` original →
  resize to the configured widths → `PutObject` each variant to R2 → write the
  resulting public URLs back into that entry's `variants`. Idempotent:
  overwrites same keys, rewrites the manifest in place.
- **`images seed --file data/images.json`** (everyone, incl. local setup;
  **no R2 credentials, no network to binaries**). Upsert `image_assets` rows
  from the manifest via `INSERT ... ON CONFLICT (id) DO UPDATE`. Because
  `variants` already holds full R2 URLs, seeding writes only strings — the
  reason local dev works against prod URLs with zero image infra.

Answering "is seeding worth it?": yes, but only the **metadata rows**, never
the bytes. That is exactly what makes local dev reproducible.

**Library choices (both minimal, no new system dependency):**
- Resize: `golang.org/x/image/draw` (CatmullRom kernel for downscale) — no
  third-party or native dependency.
- R2 upload: `minio-go` (S3-compatible client, smaller than aws-sdk-go-v2),
  pointed at the R2 endpoint.

**Config (curator only), env vars:** `R2_ENDPOINT`, `R2_ACCESS_KEY`,
`R2_SECRET`, `R2_BUCKET`, `R2_PUBLIC_BASE` (e.g. `https://img.saecula.app`).
Local/backend runtime needs none of these — it only reads public URLs.

## Backend

New module `internal/images` implementing the existing `server.API` pattern
(mounted under `/api`), plus one enrichment to the daily response.

- `GET /api/images/background` → the day's background pick from the
  `is_background` pool, deterministic by day-of-year (same rotation idea the
  mobile client uses today, moved server-side). Returns `{ url, attribution }`
  (the 1200w variant). Replaces the hardcoded `BACKGROUNDS` array.
- The existing `daily` response gains an `attribution` field, populated by
  joining `image_assets` on `daily_features.image_asset_id` (null-safe: days
  without a linked asset omit it). `image_url` is unchanged.

Reads use the same Postgres pool + sqlc pattern (`libs/db/queries/images.sql`
→ `libs/db/gen`). No graph involvement.

## Mobile

- `HomeScreen.tsx`: remove `BACKGROUNDS`, `wikimedia()`, and the
  `User-Agent` header. Fetch `/api/images/background` for the hero; keep using
  `daily.image_url` when present. Render attribution as a small caption or an
  "i" affordance over the hero.
- `ShareScreen.tsx`: remove `BG_URL` and the Wikimedia `User-Agent` header;
  use the R2 URL.
- **Fallback:** bundle one default hero asset in the app so the home is never
  blank offline or before the first fetch.

## Error handling

- Missing/failed remote image → mobile falls back to the bundled default hero.
- `images seed` is idempotent (upsert by `id`); a row missing `license` or
  `attribution` fails the seed (NOT NULL) rather than shipping unattributed art.
- `images publish` failures are per-entry; a failed download/upload leaves that
  entry's `variants` untouched so a re-run retries only what's missing.

## Testing

- CLI: resize produces the expected variant dimensions (one assert-based
  check); manifest parse round-trips; `seed` upsert is idempotent (second run
  changes nothing).
- Backend: `/api/images/background` returns a member of the `is_background`
  pool with attribution; the `daily` join includes attribution when
  `image_asset_id` is set and omits it when null.

## Out of scope / YAGNI

- Saints profile images and any Saint entity (roadmap item 5).
- On-the-fly resizing; MinIO / offline local binaries; an admin upload UI
  (curation is CLI + committed manifest).
- `images prune` for orphaned R2 keys (noted ceiling above).
- Migrating `daily_features.image_url` to a foreign key — mobile contract kept.

## Dependencies

- The **Feast art** backlog item builds directly on this storage/CDN + the
  `image_assets` catalog.
- A Cloudflare account + public R2 bucket must exist before `images publish`
  can run (one-time setup, curator only). No custom domain required — the
  `*.r2.dev` public URL works; a domain is a later cosmetic swap.
