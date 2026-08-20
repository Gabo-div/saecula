#!/usr/bin/env bash
set -euo pipefail

# Saecula E2E orchestrator (repo-wide) — full pipeline: docker-compose
# (Postgres + Neo4j), saecula-cli seed, the Go backend, and then the mobile
# Maestro flows (delegated to apps/mobile/scripts/maestro.sh).
#
# The mobile/Maestro portion lives in apps/mobile and can be run on its own
# (from apps/mobile: `bun run maestro`) — this script composes the infra
# around it. See README "End-to-end testing (E2E)".
#
# Usage (from repo root):
#   bun run e2e          # dev build

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$ANDROID_HOME/platform-tools:$HOME/.maestro/bin:$HOME/.bun/bin:$PATH"
API_URL="${EXPO_PUBLIC_API_URL:-http://10.0.2.2:8080}"


log() { printf '\n\033[1;34m[saecula-e2e]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[saecula-e2e] FAIL:\033[0m %s\n' "$*"; exit 1; }

ANCHOR_DATE="${E2E_ANCHOR_DATE:-2026-08-15}"
ANCHOR_YEAR="${ANCHOR_DATE%%-*}"

BACK_PID=""
cleanup() {
  if [ -n "$BACK_PID" ] && kill -0 "$BACK_PID" 2>/dev/null; then
    log "Stopping the backend (pid $BACK_PID)"
    kill "$BACK_PID" 2>/dev/null || true
  fi
  rm -f /tmp/saecula-back
}
trap cleanup EXIT INT TERM HUP

# --- 1. Infrastructure ---------------------------------------------------------
log "Starting Postgres + Neo4j (docker compose)"
docker compose -f "$ROOT/docker-compose.yml" up -d
for _ in $(seq 1 60); do
  pg="$(docker inspect -f '{{.State.Health.Status}}' saecula-postgres 2>/dev/null || echo starting)"
  ne="$(docker inspect -f '{{.State.Health.Status}}' saecula-neo4j 2>/dev/null || echo starting)"
  [ "$pg" = healthy ] && [ "$ne" = healthy ] && break
  sleep 2
done
[ "$(docker inspect -f '{{.State.Health.Status}}' saecula-postgres)" = healthy ] || fail "postgres not healthy"
[ "$(docker inspect -f '{{.State.Health.Status}}' saecula-neo4j)" = healthy ] || fail "neo4j not healthy"

# --- 2. Seed -------------------------------------------------------------------
log "Seeding bible + catechism (EN/ES/LA) + readings + test user"
(
  cd "$ROOT/apps/cli"
  go run . seed \
    --file data/bible_cee.json \
    --file data/catechism_ccc_en.json \
    --file data/catechism_ccc_es.json \
    --file data/catechism_ccc_la.json \
    --file data/readings_usccb.json \
    --test-user
  log "Seeding daily features ($ANCHOR_YEAR)"
  go run . daily --file data/daily_feasts.json --year "$ANCHOR_YEAR" --fill
)

# --- 3. Backend ------------------------------------------------------------------
log "Building and starting the backend on :8080"
(
  cd "$ROOT/apps/back"
  go build -o /tmp/saecula-back .
)
/tmp/saecula-back >/tmp/saecula-back.log 2>&1 &
BACK_PID=$!
for _ in $(seq 1 30); do
  curl -sf http://127.0.0.1:8080/health >/dev/null && break
  sleep 1
done
curl -sf http://127.0.0.1:8080/health >/dev/null || fail "backend not up (see /tmp/saecula-back.log)"

# --- 4. Mobile + Maestro (delegated) ---------------------------------------------
# The mobile app's Maestro runner is self-contained and independent; it handles
# device, app install, Metro and the Maestro flows. Run it, passing through the
# relevant env so the pipeline stays coherent.
log "Running mobile Maestro flows (apps/mobile/scripts/maestro.sh)"
E2E_ANCHOR_DATE="$ANCHOR_DATE" \
EXPO_PUBLIC_API_URL="$API_URL" \
E2E_BUILD="${E2E_BUILD:-1}" \
  bash "$ROOT/apps/mobile/scripts/maestro.sh"

log "E2E suite finished OK"
