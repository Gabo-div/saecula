-- +goose Up
-- Daily feature rows can now carry one or more Catechism paragraphs alongside
-- the verse of the day. Old rows get an empty array, so the home screen falls
-- back to showing just the verse for dates seeded before this migration.
ALTER TABLE daily_features
    ADD COLUMN IF NOT EXISTS catechism_numbers INTEGER[] DEFAULT '{}';
