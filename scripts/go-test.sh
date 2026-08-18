#!/usr/bin/env bash
set -euo pipefail

# Run the Go test suites for the backend and CLI across the Go workspace.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\n\033[1;34m[saecula-go-test]\033[0m %s\n' "$*"; }

for app in back cli; do
  log "go test ./... (apps/$app)"
  (
    cd "$ROOT/apps/$app"
    go test ./...
  )
done

log "Go tests finished OK"
