package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"saecula/back/internal/auth"
	"saecula/back/internal/bible"
	"saecula/back/internal/calendar"
	"saecula/back/internal/config"
	"saecula/back/internal/db"
	"saecula/back/internal/readings"
	"saecula/back/internal/server"
	"saecula/back/internal/timeline"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "error", err)
		os.Exit(1)
	}
}

// run is the composition root: every dependency is constructed exactly
// once here and injected downward. Nothing below this function reaches for
// globals.
func run() error {
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

	// --- APIs ---------------------------------------------------------------
	authAPI := auth.NewAPI(userRepo, tokens)
	timelineAPI := timeline.NewAPI(graphRepo, textRepo)
	bibleAPI := bible.NewAPI(bibleGraphRepo, bibleTextRepo)
	readingsAPI := readings.NewAPI(readingsGraphRepo, readingsTextRepo)
	calendarAPI, err := calendar.NewAPI()
	if err != nil {
		return err
	}

	// --- HTTP server --------------------------------------------------------
	srv := server.New(server.Config{
		Addr:           cfg.HTTPAddr,
		AuthMiddleware: auth.Middleware(tokens),
		PublicAPIs:     []server.API{authAPI},
		ProtectedAPIs:  []server.API{timelineAPI, bibleAPI, readingsAPI, calendarAPI},
	})

	return srv.Run(ctx)
}
