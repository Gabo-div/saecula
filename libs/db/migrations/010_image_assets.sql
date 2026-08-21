-- +goose Up
-- Curated art served from our own object storage (Cloudflare R2), off runtime
-- Wikimedia hotlinking. One row per asset; the bytes live in R2, the metadata
-- and per-width variant URLs live here. license/attribution are required so no
-- asset is ever served unattributed. Role flags (not a single category) let one
-- image be both a background and a share image.
CREATE TABLE IF NOT EXISTS image_assets (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    artist        TEXT,
    source_url    TEXT,
    license       TEXT NOT NULL,
    license_url   TEXT,
    attribution   TEXT NOT NULL,
    variants      JSONB NOT NULL,
    is_background BOOLEAN NOT NULL DEFAULT false,
    is_share      BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link the day's art to its catalog row so the daily response can carry
-- attribution. Nullable: days seeded before this migration keep working.
ALTER TABLE daily_features
    ADD COLUMN IF NOT EXISTS image_asset_id TEXT REFERENCES image_assets(id);
