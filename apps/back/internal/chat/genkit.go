package chat

import (
	"context"

	"github.com/firebase/genkit/go/genkit"
	"github.com/firebase/genkit/go/plugins/googlegenai"
)

// InitGenkit initializes Genkit with the Google AI (Gemini) plugin. It returns
// nil when no API key is configured, which leaves the chat endpoint disabled
// (503) while the rest of the server runs normally. Swapping or adding a
// provider is a change here plus the CHAT_MODEL setting — nothing else.
func InitGenkit(ctx context.Context, apiKey string) *genkit.Genkit {
	if apiKey == "" {
		return nil
	}
	return genkit.Init(ctx, genkit.WithPlugins(&googlegenai.GoogleAI{APIKey: apiKey}))
}
