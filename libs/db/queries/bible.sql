-- name: ChapterVerses :many
SELECT DISTINCT ON (entity_id) entity_id, language_code, translation_id, raw_content
FROM text_documents
WHERE entity_id LIKE sqlc.arg(prefix)::text || '%'
  AND ((sqlc.arg(translation_id)::text <> '' AND translation_id = sqlc.arg(translation_id)::text)
       OR (sqlc.arg(translation_id)::text = '' AND language_code = sqlc.arg(lang)::text))
ORDER BY entity_id, translation_id;

-- name: VerseText :one
SELECT entity_id, language_code, translation_id, raw_content
FROM text_documents
WHERE entity_id = sqlc.arg(entity_id)::text
  AND ((sqlc.arg(translation_id)::text <> '' AND translation_id = sqlc.arg(translation_id)::text)
       OR (sqlc.arg(translation_id)::text = '' AND language_code = sqlc.arg(lang)::text))
ORDER BY translation_id
LIMIT 1;

-- name: DailyFeature :one
SELECT df.verse_ids, df.image_url, df.catechism_numbers,
       df.image_asset_id, ia.attribution, ia.variants
FROM daily_features df
LEFT JOIN image_assets ia ON ia.id = df.image_asset_id
WHERE df.feature_date = $1;

-- name: BackgroundImages :many
SELECT id, variants, attribution
FROM image_assets
WHERE is_background
ORDER BY id;

-- name: CatechismParagraphsByNumbers :many
SELECT CAST(split_part(entity_id, '.', 2) AS INT) AS num, raw_content
FROM text_documents
WHERE entity_id LIKE 'CCC.%' AND language_code = $1
  AND CAST(split_part(entity_id, '.', 2) AS INT) = ANY($2::int[])
ORDER BY num;

-- name: SearchVerses :many
SELECT entity_id, raw_content
FROM text_documents
WHERE entity_id ~ '^[A-Z0-9]+\.[0-9]+\.[0-9]+$'
  AND (sqlc.arg(translation_id)::text = '' OR translation_id = sqlc.arg(translation_id)::text)
  AND to_tsvector('simple_unaccent', raw_content) @@ plainto_tsquery('simple_unaccent', sqlc.arg(query)::text)
ORDER BY ts_rank(to_tsvector('simple_unaccent', raw_content), plainto_tsquery('simple_unaccent', sqlc.arg(query)::text)) DESC, entity_id
LIMIT sqlc.arg(lim);

-- name: BookNames :many
-- Source book titles (entity_id "BIBLE.<code>"), one per book, for the given
-- edition (translation_id) or language.
SELECT DISTINCT ON (entity_id) entity_id, raw_content
FROM text_documents
WHERE entity_id LIKE 'BIBLE.%'
  AND ((sqlc.arg(translation_id)::text <> '' AND translation_id = sqlc.arg(translation_id)::text)
       OR (sqlc.arg(translation_id)::text = '' AND language_code = sqlc.arg(lang)::text))
ORDER BY entity_id, translation_id;

-- name: BibleTranslations :many
SELECT translation_id, language_code, count(*) AS verse_count
FROM text_documents
WHERE entity_id ~ '^[A-Z0-9]+\.[0-9]+\.[0-9]+$'
GROUP BY translation_id, language_code
ORDER BY language_code, translation_id;
