package config

import (
	"fmt"
	"os"
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
