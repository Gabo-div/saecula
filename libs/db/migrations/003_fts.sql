-- +goose Up
-- Full-text search over localized text (Bible verses + Catechism paragraphs).
-- The 'simple' configuration tokenizes without stemming, so it works uniformly
-- across English, Spanish, and Latin (which has no Postgres stemmer). A GIN
-- index keeps @@ lookups off a sequential scan as the corpus grows.
CREATE INDEX IF NOT EXISTS idx_text_documents_fts
    ON text_documents USING gin (to_tsvector('simple', raw_content));
