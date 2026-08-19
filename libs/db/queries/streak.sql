-- name: UpsertActivityDay :exec
INSERT INTO activity_days (user_id, day, activity_type)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, day) DO NOTHING;

-- name: ActiveDays :many
SELECT day FROM activity_days WHERE user_id = $1 ORDER BY day;

-- name: ActivityHistory :many
SELECT to_char(day, 'YYYY-MM-DD') AS day, activity_type
FROM activity_days
WHERE user_id = $1 AND day BETWEEN $2 AND $3
ORDER BY day;
