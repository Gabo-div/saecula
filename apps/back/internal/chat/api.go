package chat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/firebase/genkit/go/ai"
	"github.com/firebase/genkit/go/genkit"
	"github.com/go-chi/chi/v5"

	"saecula/back/internal/auth"
	"saecula/back/internal/httpx"
)

// maxChatRetries bounds retries of transient upstream (LLM) errors.
const maxChatRetries = 2

// isTransient reports whether an LLM error is a temporary overload/limit worth
// retrying (model busy, rate limited, briefly unavailable).
func isTransient(err error) bool {
	if err == nil {
		return false
	}
	s := err.Error()
	return strings.Contains(s, "UNAVAILABLE") ||
		strings.Contains(s, "503") ||
		strings.Contains(s, "RESOURCE_EXHAUSTED") ||
		strings.Contains(s, "429") ||
		strings.Contains(s, "high demand")
}

const systemPrompt = `You are Saecula's study assistant, helping a Catholic reader
understand Sacred Scripture, the Catechism of the Catholic Church, and the
Catholic faith.

SCOPE: Only answer questions about Catholicism, Christianity, Scripture,
theology, Church teaching, liturgy, saints, Church history, or the spiritual
life. If asked about unrelated topics (politics, sports, technology, other
religions' doctrines, etc.), politely decline and redirect to faith-related
matters.

Ground every claim in the app's own sources using the tools:
- Call search_scripture / search_catechism to find relevant passages before
  quoting or asserting their content. Never invent a verse or paragraph.
- Use get_verses / get_catechism to read a passage in full when needed.
- Use graph_related to surface connections (e.g. when a verse is read in the
  liturgy).

Always cite by id inline, exactly as returned: Scripture as BOOK.CHAPTER.VERSE
(e.g. JHN.3.16) and the Catechism as CCC.<number> (e.g. CCC.2077).

FORMAT: Use Markdown for structure — headings (##), bullet points, **bold** for
emphasis, *italics* for terms. Keep responses concise, faithful to the
Magisterium, and answer in the user's language.`

// API serves the AI assistant. When Genkit is nil (no API key configured), the
// chat endpoint reports 503 but conversation history endpoints still work.
type API struct {
	repo      Repository
	g         *genkit.Genkit
	tools     []ai.ToolRef
	model     string
	maxTurns  int
	maxTokens int
	limiter   *rateLimiter
}

func NewAPI(repo Repository, g *genkit.Genkit, tools []ai.ToolRef, model string, maxTurns, maxTokens, ratePerMin int) *API {
	return &API{
		repo:      repo,
		g:         g,
		tools:     tools,
		model:     model,
		maxTurns:  maxTurns,
		maxTokens: maxTokens,
		limiter:   &rateLimiter{perMin: ratePerMin, hits: map[string][]time.Time{}},
	}
}

func (a *API) Pattern() string { return "/chat" }

func (a *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/", a.Chat)
	r.Get("/conversations", a.ListConversations)
	r.Get("/conversations/{id}", a.GetConversation)
	r.Delete("/conversations/{id}", a.DeleteConversation)
	return r
}

type chatRequest struct {
	ConversationID string `json:"conversation_id"`
	Message        string `json:"message"`
	Lang           string `json:"lang"`
}

// toolCall summarizes one tool invocation on an assistant turn. It is persisted
// (and streamed back to the client) so the UI can show which tools produced a
// message even after a reload.
type toolCall struct {
	Name   string `json:"name"`
	Input  any    `json:"input,omitempty"`
	Output any    `json:"output,omitempty"`
	Ref    string `json:"ref,omitempty"`
	Status string `json:"status"` // "started" | "completed"
}

// POST /api/chat — streams the answer as Server-Sent Events.
func (a *API) Chat(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	if a.g == nil {
		httpx.WriteError(w, http.StatusServiceUnavailable, "chat is not enabled on this server")
		return
	}
	if !a.limiter.allow(userID) {
		httpx.WriteError(w, http.StatusTooManyRequests, "too many requests, slow down")
		return
	}

	var req chatRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid body")
		return
	}
	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" {
		httpx.WriteError(w, http.StatusBadRequest, "message is required")
		return
	}

	// Ownership + history: a supplied conversation must belong to the caller;
	// otherwise it is created only after a successful answer.
	var history []Message
	if req.ConversationID != "" {
		if _, err := a.repo.GetConversation(r.Context(), userID, req.ConversationID); err != nil {
			if errors.Is(err, ErrNotFound) {
				httpx.WriteError(w, http.StatusNotFound, "conversation not found")
				return
			}
			httpx.WriteError(w, http.StatusInternalServerError, "load conversation failed")
			return
		}
		msgs, err := a.repo.Messages(r.Context(), userID, req.ConversationID)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "load history failed")
			return
		}
		history = msgs
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		httpx.WriteError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	// Build the model conversation: system + persisted history + new turn.
	messages := make([]*ai.Message, 0, len(history)+1)
	for _, m := range history {
		if m.Role == "assistant" {
			messages = append(messages, ai.NewModelMessage(ai.NewTextPart(m.Content)))
		} else {
			messages = append(messages, ai.NewUserMessage(ai.NewTextPart(m.Content)))
		}
	}
	messages = append(messages, ai.NewUserMessage(ai.NewTextPart(req.Message)))

	// The request context already carries the authenticated userID (set by the
	// auth middleware), so tools can scope by user without extra wiring.
	streamed := false
	toolCalls := []toolCall{}
	opts := []ai.GenerateOption{
		ai.WithSystem(systemPrompt),
		ai.WithMessages(messages...),
		ai.WithTools(a.tools...),
		ai.WithModelName(a.model),
		ai.WithMaxTurns(a.maxTurns),
		// ponytail: no max-output-tokens cap yet — WithConfig needs the
		// provider's own config struct (e.g. *genai.GenerateContentConfig),
		// which would couple this to Gemini. Add per-provider config behind the
		// provider switch when a hard cap is needed; WithMaxTurns bounds tool
		// loops meanwhile.
		ai.WithStreaming(func(_ context.Context, chunk *ai.ModelResponseChunk) error {
			if t := chunk.Text(); t != "" {
				streamed = true
				sse(w, flusher, "token", map[string]string{"text": t})
			}
			for _, p := range chunk.Content {
				if p.IsToolRequest() && p.ToolRequest != nil {
					toolCalls = append(toolCalls, toolCall{
						Name:   p.ToolRequest.Name,
						Input:  p.ToolRequest.Input,
						Ref:    p.ToolRequest.Ref,
						Status: "started",
					})
					sse(w, flusher, "tool_start", map[string]any{
						"name":  p.ToolRequest.Name,
						"input": p.ToolRequest.Input,
						"ref":   p.ToolRequest.Ref,
					})
				}
				if p.IsToolResponse() && p.ToolResponse != nil {
					for i := range toolCalls {
						if toolCalls[i].Ref == p.ToolResponse.Ref {
							toolCalls[i].Output = p.ToolResponse.Output
							toolCalls[i].Status = "completed"
							break
						}
					}
					sse(w, flusher, "tool_end", map[string]any{
						"name":   p.ToolResponse.Name,
						"output": p.ToolResponse.Output,
						"ref":    p.ToolResponse.Ref,
					})
				}
			}
			return nil
		}),
	}

	// Retry transient upstream errors (503/UNAVAILABLE/429) with backoff, but
	// only while nothing has been streamed yet — once tokens are on the wire a
	// retry would duplicate them.
	var resp *ai.ModelResponse
	var err error
	for attempt := 0; ; attempt++ {
		resp, err = genkit.Generate(r.Context(), a.g, opts...)
		if err == nil || streamed || attempt >= maxChatRetries || !isTransient(err) {
			break
		}
		slog.Warn("chat generate transient error; retrying", "attempt", attempt+1, "error", err)
		time.Sleep(time.Duration(700<<attempt) * time.Millisecond)
	}
	if err != nil {
		// Nothing is persisted on failure, so a retry re-asks cleanly.
		slog.Error("chat generate failed", "error", err, "model", a.model)
		msg := "the assistant could not answer"
		if isTransient(err) {
			msg = "the assistant is busy right now, please try again"
		}
		sse(w, flusher, "error", map[string]string{"message": msg})
		return
	}

	// Persist only on clean completion: create the conversation if this was a
	// new thread, then store the user turn and the assistant turn.
	convID := req.ConversationID
	if convID == "" {
		conv, cerr := a.repo.CreateConversation(r.Context(), userID, title(req.Message))
		if cerr != nil {
			sse(w, flusher, "error", map[string]string{"message": "could not save conversation"})
			return
		}
		convID = conv.ID
	}
	if _, err := a.repo.AddMessage(r.Context(), convID, "user", req.Message, nil); err != nil {
		sse(w, flusher, "error", map[string]string{"message": "could not save message"})
		return
	}
	answer := resp.Text()
	msg, err := a.repo.AddMessage(r.Context(), convID, "assistant", answer,
		map[string]any{"model": a.model, "toolCalls": toolCalls})
	if err != nil {
		sse(w, flusher, "error", map[string]string{"message": "could not save answer"})
		return
	}

	sse(w, flusher, "done", map[string]any{
		"conversation_id": convID,
		"message_id":      msg.ID,
		"model":           a.model,
		"toolCalls":       toolCalls,
	})
}

// title derives a short conversation title from the first user message.
func title(msg string) string {
	msg = strings.TrimSpace(msg)
	runes := []rune(msg)
	if len(runes) > 60 {
		return strings.TrimSpace(string(runes[:60])) + "…"
	}
	return msg
}

// --- conversation history endpoints ---

func (a *API) ListConversations(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	convs, err := a.repo.ListConversations(r.Context(), userID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "list failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"conversations": convs})
}

func (a *API) GetConversation(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	id := chi.URLParam(r, "id")
	conv, err := a.repo.GetConversation(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "conversation not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "load failed")
		return
	}
	msgs, err := a.repo.Messages(r.Context(), userID, id)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "load messages failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"conversation": conv, "messages": msgs})
}

func (a *API) DeleteConversation(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	id := chi.URLParam(r, "id")
	if err := a.repo.DeleteConversation(r.Context(), userID, id); err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "conversation not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// rateLimiter is a naive per-process, per-user sliding-window limiter.
// ponytail: in-memory only — fine for a single instance; move to Redis if the
// backend is ever replicated.
type rateLimiter struct {
	mu     sync.Mutex
	perMin int
	hits   map[string][]time.Time
}

func (l *rateLimiter) allow(user string) bool {
	if l.perMin <= 0 {
		return true
	}
	now := time.Now()
	cutoff := now.Add(-time.Minute)
	l.mu.Lock()
	defer l.mu.Unlock()
	kept := l.hits[user][:0]
	for _, t := range l.hits[user] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= l.perMin {
		l.hits[user] = kept
		return false
	}
	l.hits[user] = append(kept, now)
	return true
}

// sse writes one Server-Sent Event frame and flushes it.
func sse(w http.ResponseWriter, f http.Flusher, event string, data any) {
	b, _ := json.Marshal(data)
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, b)
	f.Flush()
}
