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

	"saecula/db/gen"
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
	q *gen.Queries
}

var _ Repository = (*PostgresRepository)(nil)

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{q: gen.New(pool)}
}

func (r *PostgresRepository) CreateConversation(ctx context.Context, userID, title string) (Conversation, error) {
	c, err := r.q.CreateConversation(ctx, gen.CreateConversationParams{UserID: userID, Title: ptrIfNotEmpty(title)})
	if err != nil {
		return Conversation{}, err
	}
	return Conversation{ID: c.ID, Title: c.Title, CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt}, nil
}

func (r *PostgresRepository) ListConversations(ctx context.Context, userID string) ([]Conversation, error) {
	rows, err := r.q.ListConversations(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]Conversation, len(rows))
	for i, c := range rows {
		out[i] = Conversation{ID: c.ID, Title: c.Title, CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt}
	}
	return out, nil
}

func (r *PostgresRepository) GetConversation(ctx context.Context, userID, convID string) (Conversation, error) {
	c, err := r.q.GetConversation(ctx, gen.GetConversationParams{ID: convID, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return Conversation{}, ErrNotFound
	}
	if err != nil {
		return Conversation{}, err
	}
	return Conversation{ID: c.ID, Title: c.Title, CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt}, nil
}

func (r *PostgresRepository) Messages(ctx context.Context, userID, convID string) ([]Message, error) {
	rows, err := r.q.ConversationMessages(ctx, gen.ConversationMessagesParams{ConversationID: convID, UserID: userID})
	if err != nil {
		return nil, err
	}
	out := make([]Message, len(rows))
	for i, m := range rows {
		msg := Message{ID: m.ID, Role: m.Role, Content: m.Content, CreatedAt: m.CreatedAt}
		if len(m.Metadata) > 0 {
			_ = json.Unmarshal(m.Metadata, &msg.Metadata)
		}
		out[i] = msg
	}
	return out, nil
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

	m, err := r.q.AddMessage(ctx, gen.AddMessageParams{
		ConversationID: convID,
		Role:           role,
		Content:        content,
		Metadata:       raw,
	})
	if err != nil {
		return Message{}, err
	}

	// Keep the conversation's recency in step with its latest message.
	if err := r.q.TouchConversation(ctx, convID); err != nil {
		return Message{}, err
	}
	return Message{ID: m.ID, Role: m.Role, Content: m.Content, Metadata: metadata, CreatedAt: m.CreatedAt}, nil
}

func (r *PostgresRepository) DeleteConversation(ctx context.Context, userID, convID string) error {
	n, err := r.q.DeleteConversation(ctx, gen.DeleteConversationParams{ID: convID, UserID: userID})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ptrIfNotEmpty maps an empty title to NULL so the column keeps its nullable
// semantics (the read path coalesces NULL back to "").
func ptrIfNotEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
