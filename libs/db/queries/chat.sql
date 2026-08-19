-- name: CreateConversation :one
INSERT INTO chat_conversations (user_id, title)
VALUES ($1, $2)
RETURNING id, coalesce(title, '') AS title, created_at, updated_at;

-- name: ListConversations :many
SELECT id, coalesce(title, '') AS title, created_at, updated_at
FROM chat_conversations
WHERE user_id = $1
ORDER BY updated_at DESC;

-- name: GetConversation :one
SELECT id, coalesce(title, '') AS title, created_at, updated_at
FROM chat_conversations
WHERE id = $1 AND user_id = $2;

-- name: ConversationMessages :many
SELECT m.id, m.role, m.content, m.metadata, m.created_at
FROM chat_messages m
JOIN chat_conversations c ON c.id = m.conversation_id
WHERE m.conversation_id = $1 AND c.user_id = $2
ORDER BY m.created_at;

-- name: AddMessage :one
INSERT INTO chat_messages (conversation_id, role, content, metadata)
VALUES ($1, $2, $3, $4)
RETURNING id, role, content, created_at;

-- name: TouchConversation :exec
UPDATE chat_conversations SET updated_at = now() WHERE id = $1;

-- name: DeleteConversation :execrows
DELETE FROM chat_conversations WHERE id = $1 AND user_id = $2;
