package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds every runtime setting for the backend, sourced from
// environment variables with development-friendly defaults that match
// docker-compose.yml.
type Config struct {
	HTTPAddr string

	PostgresDSN string

	Neo4jURI      string
	Neo4jUser     string
	Neo4jPassword string

	JWTSecret     []byte
	JWTExpiration time.Duration

	// AI chat (Ask). Chat is enabled only when GeminiAPIKey is set; otherwise
	// the endpoint is mounted but returns 503.
	GeminiAPIKey        string
	ChatModel           string
	ChatMaxToolIters    int
	ChatMaxOutputTokens int
	ChatRatePerMin      int

	// Public MCP endpoint. Mounted only when the chat tools exist, since it
	// serves the same tool layer.
	MCPRatePerMin int

	// ImageBaseURL is the public base (CDN/R2) prepended to the relative image
	// keys stored in image_assets.variants. Kept out of the DB so the domain
	// can change in one place. Sourced from R2_PUBLIC_BASE.
	ImageBaseURL string
}

func Load() (*Config, error) {
	cfg := &Config{
		HTTPAddr:      getEnv("HTTP_ADDR", ":8080"),
		PostgresDSN:   getEnv("POSTGRES_DSN", "postgres://saecula:saecula_dev_password@localhost:5432/saecula?sslmode=disable"),
		Neo4jURI:      getEnv("NEO4J_URI", "bolt://localhost:7687"),
		Neo4jUser:     getEnv("NEO4J_USER", "neo4j"),
		Neo4jPassword: getEnv("NEO4J_PASSWORD", "saecula_dev_password"),
		JWTSecret:     []byte(getEnv("JWT_SECRET", "")),
		JWTExpiration: 24 * time.Hour,

		GeminiAPIKey:        getEnv("GEMINI_API_KEY", ""),
		ChatModel:           getEnv("CHAT_MODEL", "googleai/gemini-flash-latest"),
		ChatMaxToolIters:    getEnvInt("CHAT_MAX_TOOL_ITERS", 5),
		ChatMaxOutputTokens: getEnvInt("CHAT_MAX_OUTPUT_TOKENS", 1024),
		ChatRatePerMin:      getEnvInt("CHAT_RATE_PER_MIN", 20),

		MCPRatePerMin: getEnvInt("MCP_RATE_PER_MIN", 60),

		ImageBaseURL: strings.TrimRight(getEnv("R2_PUBLIC_BASE", ""), "/"),
	}

	if len(cfg.JWTSecret) == 0 {
		if os.Getenv("APP_ENV") == "production" {
			return nil, fmt.Errorf("JWT_SECRET must be set in production")
		}
		cfg.JWTSecret = []byte("saecula-insecure-dev-secret-change-me")
	}

	if v := os.Getenv("JWT_EXPIRATION"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			return nil, fmt.Errorf("invalid JWT_EXPIRATION %q: %w", v, err)
		}
		cfg.JWTExpiration = d
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
