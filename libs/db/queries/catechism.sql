-- name: CatechismOne :one
SELECT raw_content FROM text_documents WHERE entity_id = $1 AND language_code = $2;

-- name: CatechismByEntity :one
SELECT CAST(split_part(entity_id, '.', 2) AS INT) AS num, raw_content
FROM text_documents
WHERE entity_id = $1 AND language_code = $2;

-- name: CatechismRange :many
SELECT CAST(split_part(entity_id, '.', 2) AS INT) AS num, raw_content
FROM text_documents
WHERE entity_id LIKE 'CCC.%' AND language_code = sqlc.arg(lang)::text
  AND CAST(split_part(entity_id, '.', 2) AS INT) BETWEEN sqlc.arg(from_num)::int AND sqlc.arg(to_num)::int
ORDER BY num
LIMIT sqlc.arg(lim);

-- name: CatechismSearch :many
SELECT CAST(split_part(entity_id, '.', 2) AS INT) AS num,
       ts_headline('simple_unaccent', raw_content, plainto_tsquery('simple_unaccent', sqlc.arg(query)::text),
           'MaxWords=30,MinWords=12,StartSel=«,StopSel=»')::text AS snippet
FROM text_documents
WHERE entity_id LIKE 'CCC.%' AND language_code = sqlc.arg(lang)::text
  AND to_tsvector('simple_unaccent', raw_content) @@ plainto_tsquery('simple_unaccent', sqlc.arg(query)::text)
ORDER BY ts_rank(to_tsvector('simple_unaccent', raw_content), plainto_tsquery('simple_unaccent', sqlc.arg(query)::text)) DESC, num
LIMIT sqlc.arg(lim);

-- name: CatechismRangeDistinct :many
SELECT DISTINCT ON (CAST(split_part(entity_id, '.', 2) AS INT))
       CAST(split_part(entity_id, '.', 2) AS INT) AS num, raw_content
FROM text_documents
WHERE entity_id LIKE 'CCC.%' AND language_code = sqlc.arg(lang)::text
  AND CAST(split_part(entity_id, '.', 2) AS INT) BETWEEN sqlc.arg(from_num)::int AND sqlc.arg(to_num)::int
ORDER BY num, translation_id
LIMIT sqlc.arg(lim);
