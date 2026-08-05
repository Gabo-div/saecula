-- Curated verse-of-the-day and background image per date. When a date has no
-- row, the backend falls back to the deterministic built-in rotation.
-- verse_ids is an ordered list so a feature can be a range (e.g. the whole of
-- LUK 1,46-49), not just a single verse.
CREATE TABLE IF NOT EXISTS daily_features (
    feature_date DATE PRIMARY KEY,
    verse_ids    TEXT[] NOT NULL,
    image_url    TEXT
);
