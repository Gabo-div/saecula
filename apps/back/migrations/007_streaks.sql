-- One row per (user, calendar day) with any devotional activity. Streaks are
-- computed on read from these rows; no denormalized counters. activity_type is
-- the first activity of the day (unified streak ignores it; kept for future
-- per-activity streaks/stats).
CREATE TABLE IF NOT EXISTS activity_days (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day           DATE NOT NULL,
  activity_type TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
