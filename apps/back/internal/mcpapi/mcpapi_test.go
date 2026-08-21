package mcpapi

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/firebase/genkit/go/ai"
	"github.com/firebase/genkit/go/genkit"
	"github.com/mark3labs/mcp-go/mcp"

	"saecula/back/internal/apikeys"
)

type probeIn struct {
	Query string `json:"query"`
	Limit int    `json:"limit,omitempty"`
}

type probeOut struct {
	ID string `json:"id"`
}

func probeTool(t *testing.T, fn func(*ai.ToolContext, probeIn) ([]probeOut, error)) ai.Tool {
	t.Helper()
	g := genkit.Init(context.Background())
	if g == nil {
		t.Skip("genkit unavailable")
	}
	return genkit.DefineTool(g, "probe", "A probe tool.", fn)
}

func TestConvertKeepsTheSchema(t *testing.T) {
	tool := probeTool(t, func(_ *ai.ToolContext, in probeIn) ([]probeOut, error) {
		return []probeOut{{ID: in.Query}}, nil
	})

	converted, err := convert(tool)
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	if converted.Name != "probe" {
		t.Errorf("name = %q, want probe", converted.Name)
	}
	if converted.Description != "A probe tool." {
		t.Errorf("description = %q", converted.Description)
	}

	raw := converted.RawInputSchema
	var schema struct {
		Properties map[string]any `json:"properties"`
		Required   []string       `json:"required"`
	}
	if err := json.Unmarshal(raw, &schema); err != nil {
		t.Fatalf("unmarshal raw schema: %v (%s)", err, raw)
	}
	for _, want := range []string{"query", "limit"} {
		if _, ok := schema.Properties[want]; !ok {
			t.Errorf("property %q missing from the forwarded schema: %s", want, raw)
		}
	}
	// The point of forwarding the schema verbatim: genkit's own MCP adapter
	// rebuilds it property by property and loses this.
	if len(schema.Required) == 0 {
		t.Errorf("required list was dropped: %s", raw)
	}
}

func TestHandleReturnsJSONNotGoFormatting(t *testing.T) {
	tool := probeTool(t, func(_ *ai.ToolContext, in probeIn) ([]probeOut, error) {
		return []probeOut{{ID: in.Query}}, nil
	})

	res, err := handle(tool)(context.Background(), callToolRequest("probe", map[string]any{"query": "JHN.3.16"}))
	if err != nil {
		t.Fatalf("handle: %v", err)
	}
	if res.IsError {
		t.Fatalf("tool reported an error: %+v", res.Content)
	}

	text := textOf(t, res)
	var out []probeOut
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		t.Fatalf("result is not JSON (%q): %v", text, err)
	}
	if len(out) != 1 || out[0].ID != "JHN.3.16" {
		t.Errorf("decoded %+v, want one entry with id JHN.3.16", out)
	}
}

func TestHandleHidesInternalErrors(t *testing.T) {
	tool := probeTool(t, func(_ *ai.ToolContext, _ probeIn) ([]probeOut, error) {
		return nil, errors.New(`relation "text_documents" does not exist`)
	})

	res, err := handle(tool)(context.Background(), callToolRequest("probe", map[string]any{"query": "x"}))
	if err != nil {
		t.Fatalf("handle should report tool failure in the result, not as err: %v", err)
	}
	if !res.IsError {
		t.Fatal("failed tool call was not marked as an error")
	}
	if text := textOf(t, res); text == "" || strings.Contains(text, "text_documents") {
		t.Errorf("internal detail leaked to a public endpoint: %q", text)
	}
}

type fakeRepo struct {
	apikeys.Repository
	calls []string
	fail  error
}

func (f *fakeRepo) RecordUsage(ctx context.Context, keyID, tool string, failed bool) error {
	if f.fail != nil {
		return f.fail
	}
	suffix := ""
	if failed {
		suffix = "!"
	}
	f.calls = append(f.calls, keyID+"/"+tool+suffix)
	return nil
}

func TestUsageRecordsAgainstTheCallingKey(t *testing.T) {
	repo := &fakeRepo{}
	ok := func(context.Context, mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return mcp.NewToolResultText("{}"), nil
	}
	ctx := apikeys.WithKey(context.Background(), apikeys.Key{ID: "k1", UserID: "u1"})

	if _, err := usage(repo)(ok)(ctx, callToolRequest("get_verses", nil)); err != nil {
		t.Fatalf("usage middleware: %v", err)
	}
	if len(repo.calls) != 1 || repo.calls[0] != "k1/get_verses" {
		t.Fatalf("recorded %v, want [k1/get_verses]", repo.calls)
	}
}

func TestUsageCountsFailuresAndIgnoresUnkeyedCalls(t *testing.T) {
	repo := &fakeRepo{}
	failing := func(context.Context, mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return mcp.NewToolResultError("nope"), nil
	}
	ctx := apikeys.WithKey(context.Background(), apikeys.Key{ID: "k1"})
	if _, err := usage(repo)(failing)(ctx, callToolRequest("probe", nil)); err != nil {
		t.Fatalf("usage middleware: %v", err)
	}
	if len(repo.calls) != 1 || repo.calls[0] != "k1/probe!" {
		t.Fatalf("recorded %v, want the call flagged as failed", repo.calls)
	}

	// No key in context: nothing to bill, and no crash.
	repo.calls = nil
	if _, err := usage(repo)(failing)(context.Background(), callToolRequest("probe", nil)); err != nil {
		t.Fatalf("usage middleware without a key: %v", err)
	}
	if len(repo.calls) != 0 {
		t.Errorf("recorded %v for an unkeyed call, want nothing", repo.calls)
	}
}

func TestUsageSurvivesADisconnectedClient(t *testing.T) {
	repo := &fakeRepo{}
	ok := func(context.Context, mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return mcp.NewToolResultText("{}"), nil
	}
	ctx, cancel := context.WithCancel(
		apikeys.WithKey(context.Background(), apikeys.Key{ID: "k1"}))
	cancel() // the client hung up mid-call

	if _, err := usage(repo)(ok)(ctx, callToolRequest("probe", nil)); err != nil {
		t.Fatalf("usage middleware: %v", err)
	}
	if len(repo.calls) != 1 {
		t.Errorf("recorded %v; a cancelled call must still be accounted for", repo.calls)
	}
}

func callToolRequest(name string, args map[string]any) mcp.CallToolRequest {
	var req mcp.CallToolRequest
	req.Params.Name = name
	req.Params.Arguments = args
	return req
}

func textOf(t *testing.T, res *mcp.CallToolResult) string {
	t.Helper()
	if len(res.Content) == 0 {
		t.Fatal("result has no content")
	}
	text, ok := res.Content[0].(mcp.TextContent)
	if !ok {
		t.Fatalf("content is %T, want mcp.TextContent", res.Content[0])
	}
	return text.Text
}
