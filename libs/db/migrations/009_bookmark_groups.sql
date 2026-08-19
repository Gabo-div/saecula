-- +goose Up
-- Allow a verse to belong to a multi-verse group in addition to (and without
-- clobbering) its standalone bookmark. A standalone bookmark has group_id NULL;
-- a group is N rows sharing one group_id. The old blanket UNIQUE(user_id,
-- entity_id) is replaced by a PARTIAL unique index so there is still at most one
-- standalone bookmark per verse, while group rows are unconstrained.
ALTER TABLE user_saved_verses DROP CONSTRAINT IF EXISTS user_saved_verses_user_entity;

ALTER TABLE user_saved_verses ADD COLUMN IF NOT EXISTS group_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_saved_single
    ON user_saved_verses (user_id, entity_id)
    WHERE group_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_saved_group
    ON user_saved_verses (user_id, group_id)
    WHERE group_id IS NOT NULL;
