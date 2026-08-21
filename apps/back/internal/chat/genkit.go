package chat

import (
	"context"

	"github.com/firebase/genkit/go/genkit"
	"github.com/firebase/genkit/go/plugins/googlegenai"
)

// InitGenkit initializes Genkit, registering the Google AI (Gemini) plugin only
// when an API key is configured. The instance itself always exists: it is also
// the registry the tool layer lives in, and the MCP endpoint serves those tools
// to external hosts that bring their own model. Without a key, chat reports 503
// while everything else — including MCP — runs normally. Swapping or adding a
// provider is a change here plus the CHAT_MODEL setting, nothing else.
func InitGenkit(ctx context.Context, apiKey string) *genkit.Genkit {
	if apiKey == "" {
		return genkit.Init(ctx)
	}
	return genkit.Init(ctx, genkit.WithPlugins(&googlegenai.GoogleAI{APIKey: apiKey}))
}
