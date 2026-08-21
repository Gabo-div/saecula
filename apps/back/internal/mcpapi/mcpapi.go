// Package mcpapi serves the Genkit tool layer over MCP, so external hosts can
// read Saecula's Scripture, Catechism and concept graph. The tools are the same
// ones the in-process chat agent calls — one definition in internal/mcptools,
// two transports.
package mcpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/firebase/genkit/go/ai"
	"github.com/go-chi/chi/v5"
	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"

	"saecula/back/internal/apikeys"
	"saecula/back/internal/ratelimit"
)

const (
	serverName    = "saecula"
	serverVersion = "0.1.0"
)

// API mounts the MCP endpoint. It carries its own authentication — an API key,
// never the app's JWT — so it is registered as a public API on the server and
// guards itself.
type API struct {
	handler http.Handler
	repo    apikeys.Repository
	limiter *ratelimit.Window
}

// New builds the endpoint from the Genkit tools. It returns nil when there are
// no tools (Genkit is disabled for want of a model key), so the route is left
// unmounted rather than advertising an empty tool list to external hosts.
func New(tools []ai.Tool, repo apikeys.Repository, ratePerMin int) *API {
	if len(tools) == 0 {
		return nil
	}

	srv := mcpserver.NewMCPServer(serverName, serverVersion,
		mcpserver.WithToolCapabilities(false),
		mcpserver.WithToolHandlerMiddleware(usage(repo)),
	)

	for _, tool := range tools {
		converted, err := convert(tool)
		if err != nil {
			// A tool whose schema will not marshal would be advertised
			// unusable; skipping it is better than serving a broken contract.
			slog.Error("skipping tool on the MCP endpoint", "tool", tool.Name(), "error", err)
			continue
		}
		srv.AddTool(converted, handle(tool))
	}

	// Stateless: every request stands alone, so there is no session store to
	// keep and no affinity to preserve if the backend is ever replicated.
	return &API{
		handler: mcpserver.NewStreamableHTTPServer(srv, mcpserver.WithStateLess(true)),
		repo:    repo,
		limiter: ratelimit.New(ratePerMin),
	}
}

func (a *API) Pattern() string { return "/mcp" }

func (a *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Use(apikeys.Middleware(a.repo, a.limiter))
	r.Handle("/", a.handler)
	r.Handle("/*", a.handler)
	return r
}

// convert carries the Genkit tool's JSON Schema across verbatim. Genkit's own
// MCP plugin rebuilds the schema property by property and drops `required`,
// nesting and formats along the way; passing the raw schema keeps the contract
// the model sees identical to the one the tool validates against.
func convert(tool ai.Tool) (mcp.Tool, error) {
	def := tool.Definition()

	schema := def.InputSchema
	if schema == nil {
		schema = map[string]any{"type": "object", "properties": map[string]any{}}
	}
	raw, err := json.Marshal(schema)
	if err != nil {
		return mcp.Tool{}, fmt.Errorf("marshal input schema: %w", err)
	}

	return mcp.NewToolWithRawSchema(def.Name, def.Description, raw), nil
}

// handle runs the Genkit tool and returns its output as JSON text. Tool results
// are structured values; serializing them with fmt would hand the model Go's
// struct formatting instead of data it can parse.
func handle(tool ai.Tool) mcpserver.ToolHandlerFunc {
	return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		out, err := tool.RunRaw(ctx, req.GetArguments())
		if err != nil {
			// The detail can name tables and queries, so it stays in the log:
			// this endpoint is public.
			slog.Error("mcp tool failed", "tool", tool.Name(), "error", err)
			return mcp.NewToolResultError("the tool could not complete this request"), nil
		}

		body, err := json.Marshal(out)
		if err != nil {
			slog.Error("marshal mcp tool output", "tool", tool.Name(), "error", err)
			return mcp.NewToolResultError("the tool returned an unreadable result"), nil
		}
		return mcp.NewToolResultText(string(body)), nil
	}
}

// usage records one call per tool invocation against the calling key. It runs
// after the handler so it can see whether the call failed.
func usage(repo apikeys.Repository) mcpserver.ToolHandlerMiddleware {
	return func(next mcpserver.ToolHandlerFunc) mcpserver.ToolHandlerFunc {
		return func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			res, err := next(ctx, req)

			key, ok := apikeys.FromContext(ctx)
			if !ok {
				// No key in context means the call did not come through the
				// authenticated endpoint; nothing to bill it to.
				return res, err
			}

			failed := err != nil || (res != nil && res.IsError)
			// Detached from the request context on purpose: a client that
			// disconnects mid-call must still be accounted for, or dropping
			// the connection becomes a way to use the API for free.
			if recErr := repo.RecordUsage(context.WithoutCancel(ctx), key.ID, req.Params.Name, failed); recErr != nil {
				slog.Error("record api key usage", "tool", req.Params.Name, "error", recErr)
			}
			return res, err
		}
	}
}
