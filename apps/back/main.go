package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/firebase/genkit/go/ai"

	"saecula/back/internal/apikeys"
	"saecula/back/internal/auth"
	"saecula/back/internal/bible"
	"saecula/back/internal/bookmarks"
	"saecula/back/internal/calendar"
	"saecula/back/internal/catechism"
	"saecula/back/internal/chat"
	"saecula/back/internal/config"
	"saecula/back/internal/db"
	"saecula/back/internal/mcpapi"
	"saecula/back/internal/mcptools"
	"saecula/back/internal/readings"
	"saecula/back/internal/server"
	"saecula/back/internal/streak"
	"saecula/back/internal/timeline"
	schemadb "saecula/db"
	"saecula/env"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		if err := migrate(); err != nil {
			slog.Error("migrate failed", "error", err)
			os.Exit(1)
		}
		return
	}
	if err := run(); err != nil {
		slog.Error("fatal", "error", err)
		os.Exit(1)
	}
}

// migrate applies pending schema migrations, then exits. Kept separate from
// run() so schema changes are applied by an explicit command (one owner of the
// schema) rather than on every service boot.
func migrate() error {
	env.Load()
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	if err := schemadb.Migrate(ctx, cfg.PostgresDSN); err != nil {
		return err
	}
	slog.Info("migrations applied")
	return nil
}

// run is the composition root: every dependency is constructed exactly
// once here and injected downward. Nothing below this function reaches for
// globals.
func run() error {
	env.Load() // shared root .env; real shell env still wins

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	// Root context cancelled on SIGINT/SIGTERM — drives graceful shutdown.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	bootCtx, cancelBoot := context.WithTimeout(ctx, 15*time.Second)
	defer cancelBoot()

	// --- Infrastructure ---------------------------------------------------
	pool, err := db.NewPostgresPool(bootCtx, cfg.PostgresDSN)
	if err != nil {
		return err
	}
	defer pool.Close()
	slog.Info("connected to postgres")

	driver, err := db.NewNeo4jDriver(bootCtx, cfg.Neo4jURI, cfg.Neo4jUser, cfg.Neo4jPassword)
	if err != nil {
		return err
	}
	defer func() {
		closeCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := driver.Close(closeCtx); err != nil {
			slog.Error("close neo4j", "error", err)
		}
	}()
	slog.Info("connected to neo4j")

	// --- Services and repositories ----------------------------------------
	tokens := auth.NewTokenManager(cfg.JWTSecret, cfg.JWTExpiration)
	userRepo := auth.NewPostgresUserRepository(pool)
	graphRepo := timeline.NewNeo4jGraphRepository(driver)
	textRepo := timeline.NewPostgresTextRepository(pool)
	bibleGraphRepo := bible.NewNeo4jGraphRepository(driver)
	bibleTextRepo := bible.NewPostgresTextRepository(pool)
	readingsGraphRepo := readings.NewNeo4jGraphRepository(driver)
	readingsTextRepo := readings.NewPostgresTextRepository(pool)
	bookmarksRepo := bookmarks.NewPostgresRepository(pool)
	apiKeyRepo := apikeys.NewPostgresRepository(pool)

	// --- APIs ---------------------------------------------------------------
	authAPI := auth.NewAPI(userRepo, tokens)
	timelineAPI := timeline.NewAPI(graphRepo, textRepo)
	bibleAPI := bible.NewAPI(bibleGraphRepo, bibleTextRepo)
	readingsAPI := readings.NewAPI(readingsGraphRepo, readingsTextRepo)
	calendarAPI, err := calendar.NewAPI()
	if err != nil {
		return err
	}
	catechismAPI := catechism.NewAPI(pool)
	bookmarksAPI := bookmarks.NewAPI(bookmarksRepo)
	streakAPI := streak.NewAPI(streak.NewPostgresRepository(pool))
	keysAPI := apikeys.NewAPI(apiKeyRepo)

	// AI assistant ("Ask"): Genkit runs the agent; the tools read the app's
	// own content and graph. Disabled (503) when no Gemini key is set.
	genkitApp := chat.InitGenkit(ctx, cfg.GeminiAPIKey)
	tools := mcptools.Register(genkitApp, mcptools.Deps{
		Scripture: bibleTextRepo,
		Pool:      pool,
		Neo4j:     driver,
	})

	// The tools are pure reads over our own stores, so they serve external MCP
	// hosts with no model of ours involved. Only chat needs a provider key:
	// without one its model is empty and the endpoint reports 503.
	chatModel := cfg.ChatModel
	if cfg.GeminiAPIKey == "" {
		chatModel = ""
		slog.Warn("no GEMINI_API_KEY: chat disabled, MCP tools still served")
	}
	chatAPI := chat.NewAPI(chat.NewPostgresRepository(pool), genkitApp, toolRefs(tools),
		chatModel, cfg.ChatMaxToolIters, cfg.ChatMaxOutputTokens, cfg.ChatRatePerMin)

	// The public MCP endpoint serves the same tools to external hosts,
	// authenticated by API key rather than a session token. It is only mounted
	// when the tools exist, so hosts never see an empty tool list.
	publicAPIs := []server.API{authAPI}
	if mcpAPI := mcpapi.New(tools, apiKeyRepo, cfg.MCPRatePerMin); mcpAPI != nil {
		publicAPIs = append(publicAPIs, mcpAPI)
		slog.Info("public MCP endpoint mounted", "path", "/mcp", "tools", len(tools))
	}

	// --- HTTP server --------------------------------------------------------
	srv := server.New(server.Config{
		Addr:           cfg.HTTPAddr,
		AuthMiddleware: auth.Middleware(tokens),
		PublicAPIs:     publicAPIs,
		ProtectedAPIs:  []server.API{timelineAPI, bibleAPI, readingsAPI, calendarAPI, catechismAPI, chatAPI, bookmarksAPI, streakAPI, keysAPI},
	})

	return srv.Run(ctx)
}

// toolRefs narrows the tool list to what the chat agent's WithTools option
// takes. The MCP endpoint needs the full ai.Tool, so Register returns that and
// this drops down to refs here rather than defining the tools twice.
func toolRefs(tools []ai.Tool) []ai.ToolRef {
	refs := make([]ai.ToolRef, len(tools))
	for i, t := range tools {
		refs[i] = t
	}
	return refs
}
