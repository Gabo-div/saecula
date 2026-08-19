-- +goose Up
-- Saecula: Localized Translation Store (PostgreSQL)
-- Neo4j holds the language-agnostic concept graph; this database holds
-- only text payloads keyed by the universal entity_id slug.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS text_documents (
    -- Universal conceptual slug, e.g. "JHN.3.16", "CCC.1422", "COUNCIL.NICEA.I"
    entity_id      VARCHAR(255) NOT NULL,
    -- ISO 639-1, e.g. "es", "en", "la"
    language_code  VARCHAR(8)   NOT NULL,
    -- Distinct source edition, e.g. "jerusalem_1976", "vulgata", "cee_2011"
    translation_id VARCHAR(64)  NOT NULL,
    raw_content    TEXT         NOT NULL,
    -- Structural footnotes or native cross-reference strings
    metadata       JSONB        NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT text_documents_pkey PRIMARY KEY (entity_id, language_code, translation_id)
);

-- Lookup pattern of the /api/timeline hybrid query:
-- WHERE entity_id = ANY($ids) AND language_code = $lang
CREATE INDEX IF NOT EXISTS idx_text_documents_lang
    ON text_documents (language_code, entity_id);
