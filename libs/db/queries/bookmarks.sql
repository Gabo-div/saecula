-- name: ListSavedVerses :many
SELECT * FROM user_saved_verses
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: ListSavedVersesHighlighted :many
SELECT * FROM user_saved_verses
WHERE user_id = $1 AND highlight_color IS NOT NULL
ORDER BY created_at DESC;

-- name: ListSavedVersesWithNotes :many
SELECT * FROM user_saved_verses
WHERE user_id = $1 AND note IS NOT NULL AND note != ''
ORDER BY created_at DESC;

-- name: GetSavedVerse :one
SELECT * FROM user_saved_verses
WHERE user_id = $1 AND entity_id = $2 AND group_id IS NULL;

-- name: UpsertSavedVerse :one
INSERT INTO user_saved_verses (user_id, entity_id, reference, verse_text, highlight_color, note)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (user_id, entity_id) WHERE group_id IS NULL DO UPDATE SET
    highlight_color = COALESCE(EXCLUDED.highlight_color, user_saved_verses.highlight_color),
    note            = COALESCE(EXCLUDED.note, user_saved_verses.note),
    verse_text      = EXCLUDED.verse_text,
    reference       = EXCLUDED.reference,
    updated_at      = now()
RETURNING *;

-- name: UpdateSavedVerseHighlight :exec
UPDATE user_saved_verses
SET highlight_color = $3, updated_at = now()
WHERE user_id = $1 AND entity_id = $2 AND group_id IS NULL;

-- name: UpdateSavedVerseNote :exec
UPDATE user_saved_verses
SET note = $3, updated_at = now()
WHERE user_id = $1 AND entity_id = $2 AND group_id IS NULL;

-- name: DeleteSavedVerse :exec
DELETE FROM user_saved_verses WHERE user_id = $1 AND entity_id = $2 AND group_id IS NULL;

-- name: DeleteSavedVerseByID :exec
DELETE FROM user_saved_verses WHERE user_id = $1 AND id = $2;

-- name: CountSavedVerses :one
SELECT count(*) FROM user_saved_verses WHERE user_id = $1;

-- name: NewGroupID :one
SELECT gen_random_uuid();

-- name: InsertGroupedVerse :one
INSERT INTO user_saved_verses (user_id, entity_id, reference, verse_text, highlight_color, note, group_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: DeleteBookmarkGroup :execrows
DELETE FROM user_saved_verses WHERE user_id = $1 AND group_id = $2;
