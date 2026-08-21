-- +goose Up
-- API keys authenticate the public MCP endpoint. They are a second credential
-- class alongside the app's JWT: a key belongs to a user, does not expire, and
-- is revoked rather than deleted so a prefix seen in a log stays traceable to
-- its owner. Only the SHA-256 of the key is stored — the plaintext exists once,
-- in the response that creates it.
CREATE TABLE IF NOT EXISTS api_keys (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash   CHAR(64) UNIQUE NOT NULL,
    -- Non-secret leading fragment, shown in listings ("sk_saecula_Ab3dEf").
    prefix     VARCHAR(24) NOT NULL,
    name       VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    revoked_at TIMESTAMP
);

-- The verification path selects on key_hash (already unique-indexed); this
-- index serves the owner's listing, which only ever wants live keys.
CREATE INDEX IF NOT EXISTS idx_api_keys_user
    ON api_keys (user_id)
    WHERE revoked_at IS NULL;

-- Usage is pre-aggregated per (key, UTC day, tool) instead of logged per call:
-- a dashboard wants counts over time, and this shape bounds the table at
-- (keys x tools) rows per day, so there is no retention policy to run and no
-- unbounded event log to prune.
CREATE TABLE IF NOT EXISTS api_key_usage (
    key_id UUID        NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    day    DATE        NOT NULL,
    tool   VARCHAR(64) NOT NULL,
    calls  INTEGER     NOT NULL DEFAULT 0,
    errors INTEGER     NOT NULL DEFAULT 0,

    CONSTRAINT api_key_usage_pkey PRIMARY KEY (key_id, day, tool)
);
