// Package chat serves the AI assistant ("Ask"): a JWT-protected streaming
// endpoint that answers with the app's own content and concept graph via
// Genkit tools, plus persistence for per-user conversations.
package chat

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a conversation does not exist or is not owned by
// the requesting user (the two are indistinguishable to the caller by design).
var ErrNotFound = errors.New("conversation not found")

// Conversation is one chat thread owned by a user.
type Conversation struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Message is one user-visible turn. Metadata carries the tools consulted and
// citations for an assistant turn (nil for a user turn).
type Message struct {
	ID        string         `json:"id"`
	Role      string         `json:"role"` // "user" | "assistant"
	Content   string         `json:"content"`
	Metadata  map[string]any `json:"metadata,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
}

// Repository persists conversations and messages, scoped to their owner.
type Repository interface {
	CreateConversation(ctx context.Context, userID, title string) (Conversation, error)
	ListConversations(ctx context.Context, userID string) ([]Conversation, error)
	// GetConversation returns the conversation only if owned by userID, else
	// ErrNotFound.
	GetConversation(ctx context.Context, userID, convID string) (Conversation, error)
	// Messages returns a conversation's messages in order, checking ownership.
	Messages(ctx context.Context, userID, convID string) ([]Message, error)
	AddMessage(ctx context.Context, convID, role, content string, metadata map[string]any) (Message, error)
	DeleteConversation(ctx context.Context, userID, convID string) error
}

type PostgresRepository struct {
	pool *pgxpool.Pool
}

var _ Repository = (*PostgresRepository)(nil)

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (r *PostgresRepository) CreateConversation(ctx context.Context, userID, title string) (Conversation, error) {
	var c Conversation
	err := r.pool.QueryRow(ctx,
		`INSERT INTO chat_conversations (user_id, title)
		 VALUES ($1, $2)
		 RETURNING id, coalesce(title, ''), created_at, updated_at`,
		userID, title).Scan(&c.ID, &c.Title, &c.CreatedAt, &c.UpdatedAt)
	return c, err
}

func (r *PostgresRepository) ListConversations(ctx context.Context, userID string) ([]Conversation, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, coalesce(title, ''), created_at, updated_at
		 FROM chat_conversations
		 WHERE user_id = $1
		 ORDER BY updated_at DESC`,
		userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Conversation{}
	for rows.Next() {
		var c Conversation
		if err := rows.Scan(&c.ID, &c.Title, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *PostgresRepository) GetConversation(ctx context.Context, userID, convID string) (Conversation, error) {
	var c Conversation
	err := r.pool.QueryRow(ctx,
		`SELECT id, coalesce(title, ''), created_at, updated_at
		 FROM chat_conversations
		 WHERE id = $1 AND user_id = $2`,
		convID, userID).Scan(&c.ID, &c.Title, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Conversation{}, ErrNotFound
	}
	return c, err
}

func (r *PostgresRepository) Messages(ctx context.Context, userID, convID string) ([]Message, error) {
	// Ownership is enforced by the join to the owning conversation.
	rows, err := r.pool.Query(ctx,
		`SELECT m.id, m.role, m.content, m.metadata, m.created_at
		 FROM chat_messages m
		 JOIN chat_conversations c ON c.id = m.conversation_id
		 WHERE m.conversation_id = $1 AND c.user_id = $2
		 ORDER BY m.created_at`,
		convID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Message{}
	for rows.Next() {
		var (
			m   Message
			raw []byte
		)
		if err := rows.Scan(&m.ID, &m.Role, &m.Content, &raw, &m.CreatedAt); err != nil {
			return nil, err
		}
		if len(raw) > 0 {
			_ = json.Unmarshal(raw, &m.Metadata)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *PostgresRepository) AddMessage(ctx context.Context, convID, role, content string, metadata map[string]any) (Message, error) {
	var raw []byte
	if metadata != nil {
		b, err := json.Marshal(metadata)
		if err != nil {
			return Message{}, err
		}
		raw = b
	}

	var m Message
	err := r.pool.QueryRow(ctx,
		`INSERT INTO chat_messages (conversation_id, role, content, metadata)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, role, content, created_at`,
		convID, role, content, raw).Scan(&m.ID, &m.Role, &m.Content, &m.CreatedAt)
	if err != nil {
		return Message{}, err
	}
	m.Metadata = metadata

	// Keep the conversation's recency in step with its latest message.
	_, err = r.pool.Exec(ctx,
		`UPDATE chat_conversations SET updated_at = now() WHERE id = $1`, convID)
	return m, err
}

func (r *PostgresRepository) DeleteConversation(ctx context.Context, userID, convID string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM chat_conversations WHERE id = $1 AND user_id = $2`,
		convID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
