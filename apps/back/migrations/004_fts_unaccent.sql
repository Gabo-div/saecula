-- Accent-insensitive full-text search: "oracion" matches "oración".
-- A 'simple'-based configuration with the unaccent dictionary folds accents at
-- both index and query time, uniformly across English, Spanish, and Latin.
CREATE EXTENSION IF NOT EXISTS unaccent;

DROP TEXT SEARCH CONFIGURATION IF EXISTS simple_unaccent;
CREATE TEXT SEARCH CONFIGURATION simple_unaccent (COPY = simple);
ALTER TEXT SEARCH CONFIGURATION simple_unaccent
    ALTER MAPPING FOR asciiword, asciihword, hword_asciipart, word, hword, hword_part,
        numword, numhword, hword_numpart
    WITH unaccent, simple;

DROP INDEX IF EXISTS idx_text_documents_fts;
CREATE INDEX idx_text_documents_fts
    ON text_documents USING gin (to_tsvector('simple_unaccent', raw_content));
