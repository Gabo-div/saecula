-- User-generated content: saved verses, highlights, and personal notes.
-- Each row is scoped to a user and identifies a Bible verse by entity_id
-- (BOOK.CHAPTER.VERSE). Highlights carry a colour; notes carry free text.

CREATE TABLE IF NOT EXISTS user_saved_verses (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_id  VARCHAR(255) NOT NULL,
    -- Denormalised reference for display without a second query.
    reference  VARCHAR(255) NOT NULL DEFAULT '',
    verse_text TEXT         NOT NULL DEFAULT '',
    -- Optional highlight colour (NULL = bookmark only, no highlight).
    highlight_color VARCHAR(16),
    -- Optional personal note attached to the verse.
    note       TEXT,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT user_saved_verses_user_entity UNIQUE (user_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_user_saved_verses_user
    ON user_saved_verses (user_id, created_at DESC);
