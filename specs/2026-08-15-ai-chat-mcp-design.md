# AI Chat + MCP Tools — Design

Date: 2026-08-15
Status: Approved for implementation planning

## Overview

Add a conversational AI assistant ("Ask") to Saecula. A signed-in user chats with
an LLM that can read the app's own content and concept graph — Scripture,
Catechism, and their Neo4j relationships — through a fixed set of tools, and
answers with citations (`JHN.3.16`, `CCC.2077`). Conversations are persisted per
user. The model provider is swappable; the same tools are reusable by future
external AI hosts through MCP.

The agent runtime is **Firebase Genkit (Go)**: it provides model-agnostic
generation, the tool-calling loop, streaming, and MCP interop, so we do not
hand-roll a provider abstraction or an agent loop.

## Goals

- A `POST /api/chat` streaming endpoint, behind the existing JWT middleware, that
  answers questions using the app's content and graph.
- Tools that expose Scripture, Catechism, and graph relationships, defined once
  and consumed by the in-process agent now, and mountable as an MCP server for
  external hosts later — with no rewrite of the tool bodies.
- Model provider swappable by changing configuration, not code touching the
  front end or the tools. Gemini is the first (and initially only) provider.
- Conversations persisted in Postgres, scoped to the owning user.
- A mobile chat UI (Expo/RN) reached from the Home "Ask" action: streamed
  answers, a conversation history, and citations that deep-link into the Bible
  and Catechism readers.

## Non-goals (this iteration)

- No external/public MCP endpoint yet (in-process only; the design keeps the
  door open — see "Future: external MCP").
- No second model provider implemented yet (interface via Genkit is ready).
- No retrieval-augmented embeddings/vector store. Tools query existing
  FTS/graph directly. Add embeddings later if answer quality needs it.
- No cross-reference resolution work beyond what the graph already holds.

## Architecture

Mobile talks only to our own authenticated endpoint. The backend hosts the
agent and the tools; the LLM provider is called by Genkit.

```
Mobile ──JWT──> POST /api/chat (Chi, SSE)
                    │  loads/saves history (Postgres)
                    ▼
              internal/chat  ── Genkit agent (Generate + tools + streaming)
                    │                         │
                    │                         └──> LLM provider (Gemini via Genkit plugin)
                    ▼
              internal/mcptools  ── Genkit tools (thin wrappers over repos)
                    │
                    ├──> bible/catechism repos ──> Postgres (FTS + reads)
                    └──> graph repo            ──> Neo4j (relationships)
```

### Packages (new, in `apps/back`)

- **`internal/mcptools`** — the tool layer and single source of truth for what
  the AI may access. Each tool is a Genkit tool (`genkit.DefineTool`) that wraps
  an existing repository call and returns compact JSON (ids + text). Tools read
  the caller's `userID` through one helper, `userFromContext(ctx)`, so the
  transport (in-process now, HTTP later) is invisible to tool bodies. A
  constructor `Register(g *genkit.Genkit, deps) []ai.ToolRef` wires the repos in
  and returns the tool refs for the agent.
- **`internal/chat`** — the agent and the HTTP surface:
  - `API` implementing the existing `server.API` interface (`Pattern() =>
    "/chat"`, `Routes()`), registered in `main.go` under `ProtectedAPIs`.
  - The Genkit streaming flow that runs `genkit.Generate(ctx, g,
    ai.WithModelName(cfg.Model), ai.WithMessages(history...), ai.WithTools(tools...),
    ai.WithStreaming(onChunk))`.
  - `Repository` for conversation/message persistence (Postgres).

Genkit is initialized once in `main.go` (`genkit.Init(ctx,
genkit.WithPlugins(&googlegenai.GoogleAI{APIKey: cfg.GeminiAPIKey}),
genkit.WithDefaultModel(cfg.ChatModel))`) and injected into `mcptools.Register`
and `chat.NewAPI`.

## Tools (v1)

Minimal set mapped to data that already exists. Names, inputs, outputs:

- `search_scripture{ query, lang, translation? }` → `[{entity_id, reference, text}]`
  (Bible FTS; the endpoint already exists as `SearchVerses`).
- `get_verses{ book, chapter, verse_from?, verse_to?, lang }` → `[{entity_id,
  number, text}]` (chapter/verse read).
- `search_catechism{ query, lang }` → `[{number, snippet}]`.
- `get_catechism{ from, to?, lang }` → `[{number, text}]`.
- `graph_related{ entity_id }` → `[{entity_id, relation, label}]` — neighbors in
  Neo4j (cross-references, feast/day links). This is the graph access.

All tools default `lang` to the request's language and cap result counts. They
never mutate. They return ids so the model can cite; the system prompt instructs
the model to cite by id and to call a tool before asserting content.

## Data model (persistence)

Migration `005_chat.sql` (applied through the existing migration mechanism):

```sql
CREATE TABLE IF NOT EXISTS chat_conversations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT,                       -- derived from the first user message
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user
    ON chat_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content         TEXT NOT NULL,
    metadata        JSONB,                 -- tool calls made, citations, token usage
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
    ON chat_messages (conversation_id, created_at);
```

Only the user-visible turns (`user`, `assistant`) are persisted. Intermediate
tool calls/results are transient to the agent loop; a summary of which tools ran
and the citations is kept in the assistant message's `metadata` for traceability
and UI ("consulted CCC.2077"). This keeps history replayable without storing raw
tool payloads.

## HTTP API

All routes under `/api/chat`, JWT-protected; `userID` comes from the JWT claims.

- `POST /api/chat` — body `{ conversation_id?, message }`.
  - No `conversation_id` → create a conversation for the user (title from the
    first message).
  - Loads prior messages for that conversation (verifying ownership), appends the
    new user message, runs the agent, streams the answer, then persists the user
    message and the final assistant message.
  - Response: `text/event-stream` with events `token` (answer delta), `tool`
    (optional: `{name}` for a "consulting…" UI hint), `done`
    (`{conversation_id, message_id}`), `error`.
- `GET /api/chat/conversations` — the user's conversations (id, title,
  updated_at), newest first.
- `GET /api/chat/conversations/{id}` — messages of one conversation (ownership
  checked); 404 if not owned.
- `DELETE /api/chat/conversations/{id}` — delete (cascade), ownership checked.

## Agent flow (one message)

1. Handler authenticates (JWT middleware), extracts `userID`, resolves/creates the
   conversation, verifies ownership.
2. Builds the message list: system prompt + persisted history + new user message.
   `userID` is placed on the context passed to `Generate` so tools can read it.
3. `genkit.Generate` runs the tool loop internally: model may request tools →
   Genkit invokes the corresponding `mcptools` tool → result fed back → repeat
   until a final answer. A per-turn cap on tool iterations guards runaway loops.
4. Streaming callback forwards answer deltas to the SSE writer; tool invocations
   optionally emit a `tool` event.
5. On completion, persist the user message and the assistant message (with
   metadata: tools used, citations, usage). Emit `done`. Update
   `conversations.updated_at`.

## Model-agnostic strategy

Genkit is the abstraction. Switching providers means:
- add the provider's plugin to `genkit.Init` (`WithPlugins`), and
- set `cfg.ChatModel` (e.g. `googleai/gemini-2.5-flash` → `openai/gpt-4o` →
  `vertexai/claude-…`).

No change to tools, endpoint, persistence, or the mobile client. Tools are Genkit
tools, so their schemas are translated to each provider's function-calling format
by Genkit, not by us.

## Security

- `/api/chat*` sits in `ProtectedAPIs` → the existing JWT middleware runs first;
  unauthenticated requests never reach the agent.
- Ownership: every conversation/message query filters by `user_id`; reads/deletes
  of a non-owned conversation return 404.
- Tools authorize on `userFromContext(ctx)`. v1 content (Scripture, Catechism,
  public graph) is readable by any signed-in user; the helper is in place so
  future per-user data (notes, bookmarks) checks ownership without touching call
  sites.
- Cost/abuse guards: per-user rate limit on `POST /api/chat`; a per-turn cap on
  tool-call iterations; a max output-token setting on the model call; a max input
  history length (truncate/oldest-drop) so context stays bounded.
- The Gemini API key is server-side config only; the mobile client never holds a
  model key.

## Future: external MCP (kept open, not built now)

The same `mcptools` tools can be mounted as a Genkit MCP server. When an external
host must reach them, add an HTTP transport guarded by
`auth.RequireBearerToken(verifier, {Scopes})` where `verifier` validates the same
JWT; tool bodies switch to reading `req.Extra.TokenInfo` — hidden behind
`userFromContext`, so no tool body changes. This is why the tool layer is defined
independently of the chat endpoint.

## Error handling

- Provider/tool errors during a turn: emit an `error` SSE event with a safe
  message; do not persist a partial assistant message (persist only on clean
  completion). Log the detail server-side.
- Tool returning no results is a normal result (the model reports "not found"),
  not an error.
- Ownership/validation failures: standard 4xx via `httpx` before streaming starts.
- If the stream breaks mid-answer, the user message is still persisted only after
  a clean finish, so a retry re-asks cleanly rather than duplicating.

## Testing

- **Tools** (`internal/mcptools`): unit-test each tool against a seeded test DB
  (or repo fakes) — assert it returns the expected ids/text for a known query.
- **Agent/handler** (`internal/chat`): use a Genkit test/fake model that scripts
  a tool call then a final answer; assert the right tool ran, the answer streamed,
  and exactly the user + assistant messages persisted with citation metadata.
- **Persistence**: ownership isolation test — user A cannot read/delete user B's
  conversation.
- **Config/provider**: a smoke test that `genkit.Init` wires the configured model
  name.

## Configuration

Add to `internal/config`:
- `GeminiAPIKey` (`GEMINI_API_KEY`, required to enable chat; if empty, `/api/chat`
  is registered but returns 503 "chat disabled").
- `ChatModel` (`CHAT_MODEL`, default `googleai/gemini-2.5-flash`).
- `ChatMaxToolIters` (default 5), `ChatMaxOutputTokens` (default 1024),
  `ChatRatePerMin` (default 20).

## Mobile (Expo / React Native)

The feature ships end to end: the "Ask" quick action on Home opens the chat.

### Transport — SSE over `expo/fetch`

Consume the `POST /api/chat` stream with `expo/fetch` (Expo 54:
`import { fetch } from 'expo/fetch'`), whose `response.body` is a real
`ReadableStream` and which accepts POST + custom headers (the JWT) + an
`AbortSignal`. No extra SSE dependency. A small pure parser turns the byte
stream into SSE frames:

- read `response.body.getReader()`, `TextDecoder` the chunks, buffer and split
  on `\n\n`, parse `event:`/`data:` lines, dispatch `token` / `tool` / `done` /
  `error`.
- the parser is a standalone function so it is unit-tested without a device.

The Authorization bearer comes from the existing auth store; `expo/fetch` is
used only for the streaming call, the rest of the client stays on axios.

### Navigation

Home becomes a native stack `HomeStack` (mirroring the Calendar/Prayers stacks):
`HomeHome` (current `HomeScreen`) → `Chat` → `Conversations`. The Home "Ask"
quick action navigates to `Chat` (a fresh conversation). `Chat`'s header has a
history icon → `Conversations` (the user's past chats, newest first, with a
"new chat" action); tapping one opens `Chat` with its `conversationId`.

### Screens

- **ChatScreen** — a message thread (user bubbles right, assistant left, serif
  body for the assistant), an input bar with send, and an assistant bubble that
  grows token-by-token while streaming. A small chip ("consulting Scripture…")
  shows on `tool` events. Input is disabled while streaming; leaving the screen
  aborts via `AbortController`. On `error`, show a retry affordance. If the
  backend returns 503 (chat disabled — no API key), show a friendly disabled
  state.
- **ConversationsScreen** — list of the user's conversations (title +
  updated_at), swipe/long-press to delete (confirm), tap to open, plus a
  "new chat" button.

### Citations → deep links

The assistant is prompted to cite by id. The renderer linkifies ids in the
answer (`JHN.3.16`, `CCC.2077`) into tappable links:
- Scripture → switch to the Bible tab and `readerStore.setLocation(book,
  chapter, verse)` — the reader already scrolls to and highlights the verse.
- Catechism → switch to the Catechism tab and focus the paragraph. This needs
  the Catechism reader's target lifted into a small `useCatechismStore`
  (`focusParagraph`, mirroring `readerStore.targetVerse`), since its
  language/section/focus are currently local component state. The reader then
  reuses the existing section-resolution + scroll-to + highlight behavior.

Linkified citations are a defined part of this design; if the catechism-store
lift proves larger than expected during planning, it may be split into its own
follow-up plan, but the Bible citations work with the current store as-is.

### State & API client

- `src/api/client.ts`: `streamChat({conversationId?, message, lang, onToken,
  onTool, signal})`, `listConversations()`, `getConversation(id)`,
  `deleteConversation(id)`.
- `src/types/api.ts`: `ChatConversation`, `ChatMessage`, SSE event payloads.
- Chat thread state is per-screen (messages, streaming flag, partial assistant
  text); the server is the source of truth, so there is no persisted client
  store beyond `useCatechismStore.focusParagraph` for deep links.
- i18n: a new `chat` namespace (title, placeholder, newChat, history, empty,
  thinking, consulting, error, deleteConfirm, disabled) in en/es/la.

### Mobile testing

The repo has no mobile tests yet; keep it minimal — one unit test for the SSE
frame parser (the only non-trivial, device-independent logic). Broader mobile
testing is out of scope.
