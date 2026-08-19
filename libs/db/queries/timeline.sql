-- name: TimelineTexts :many
SELECT DISTINCT ON (entity_id) entity_id, language_code, translation_id, raw_content, metadata
FROM text_documents
WHERE entity_id = ANY(sqlc.arg(entity_ids)::text[])
  AND ((sqlc.arg(translation_id)::text <> '' AND translation_id = sqlc.arg(translation_id)::text)
       OR (sqlc.arg(translation_id)::text = '' AND language_code = sqlc.arg(lang)::text))
ORDER BY entity_id, translation_id;
