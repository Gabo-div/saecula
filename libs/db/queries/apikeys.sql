-- name: CreateAPIKey :one
INSERT INTO api_keys (user_id, key_hash, prefix, name)
VALUES ($1, $2, $3, $4)
RETURNING id, prefix, name, created_at;

-- name: GetAPIKeyByHash :one
SELECT id, user_id
FROM api_keys
WHERE key_hash = $1 AND revoked_at IS NULL;

-- name: ListAPIKeys :many
SELECT k.id, k.prefix, k.name, k.created_at,
       COALESCE(SUM(u.calls), 0)::bigint   AS total_calls,
       COALESCE(SUM(u.errors), 0)::bigint  AS total_errors
FROM api_keys k
LEFT JOIN api_key_usage u ON u.key_id = k.id
WHERE k.user_id = $1 AND k.revoked_at IS NULL
GROUP BY k.id, k.prefix, k.name, k.created_at
ORDER BY k.created_at DESC;

-- name: RevokeAPIKey :execrows
UPDATE api_keys
SET revoked_at = now()
WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL;

-- name: RecordAPIKeyUsage :exec
INSERT INTO api_key_usage (key_id, day, tool, calls, errors)
VALUES ($1, (now() AT TIME ZONE 'utc')::date, $2, 1, $3)
ON CONFLICT (key_id, day, tool) DO UPDATE
   SET calls  = api_key_usage.calls + 1,
       errors = api_key_usage.errors + EXCLUDED.errors;

-- name: ListAPIKeyUsage :many
SELECT u.key_id, k.prefix, u.day, u.tool, u.calls, u.errors
FROM api_key_usage u
JOIN api_keys k ON k.id = u.key_id
WHERE k.user_id = $1 AND u.day >= $2
ORDER BY u.day DESC, u.tool;
