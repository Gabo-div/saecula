#!/usr/bin/env bash
set -euo pipefail

# Saecula E2E orchestrator — full pipeline: docker-compose (Postgres + Neo4j),
# saecula-cli seed, the Go backend, and the Maestro flows against an Android
# emulator. See README "End-to-end testing (E2E)".

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The seeded day the suite is anchored to. Keep in sync with the flows.
ANCHOR_DATE="${E2E_ANCHOR_DATE:-2026-08-15}"
ANCHOR_YEAR="${ANCHOR_DATE%%-*}"
ANCHOR_MMDD="$(printf '%s%s' "${ANCHOR_DATE:5:2}" "${ANCHOR_DATE:8:2}")"   # 0815
ANCHOR_CCYY="${ANCHOR_DATE:0:4}"                                            # 2026
APP_ID="com.saecula.app"
API_URL="${EXPO_PUBLIC_API_URL:-http://10.0.2.2:8080}"

log() { printf '\n\033[1;34m[saecula-e2e]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[saecula-e2e] FAIL:\033[0m %s\n' "$*"; exit 1; }

BACK_PID=""
METRO_PID=""

cleanup() {
  if [ -n "$BACK_PID" ] && kill -0 "$BACK_PID" 2>/dev/null; then
    log "Stopping the backend (pid $BACK_PID)"
    kill "$BACK_PID" 2>/dev/null || true
  fi
  if [ -n "$METRO_PID" ] && kill -0 "$METRO_PID" 2>/dev/null; then
    log "Stopping Metro (pid $METRO_PID)"
    kill "$METRO_PID" 2>/dev/null || true
  fi
  rm -f /tmp/saecula-back
}
trap cleanup EXIT

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

# --- 4. Emulator -----------------------------------------------------------------
adb devices | grep -q "device$" || fail "no emulator/device attached (start an AVD first)"
log "Pinning emulator clock to $ANCHOR_DATE and locale to es-ES"
adb root >/dev/null 2>&1 || true
adb shell "settings put global auto_time 0" >/dev/null 2>&1 || true
adb shell "date ${ANCHOR_MMDD}1200${ANCHOR_CCYY}.00" >/dev/null 2>&1 \
  || adb shell "date -s $(date -d "$ANCHOR_DATE" +%Y%m%d.1200)" >/dev/null 2>&1 \
  || log "WARNING: could not set the emulator clock — flows need the device on $ANCHOR_DATE"
adb shell "settings put system system_locales es-ES" >/dev/null 2>&1 || true
adb shell "am force-stop $APP_ID" >/dev/null 2>&1 || true

# --- 5. App install ---------------------------------------------------------------
log "Building + installing the app (expo run:android, API=$API_URL)"
(
  cd "$ROOT/apps/mobile"
  EXPO_PUBLIC_API_URL="$API_URL" bun --bun x expo run:android --variant debug --no-bundler
)

# --- 5b. Metro bundler ---------------------------------------------------------------
log "Starting Metro dev server (port 8081)"
(
  cd "$ROOT/apps/mobile"
  EXPO_PUBLIC_API_URL="$API_URL" nohup bun --bun x expo start --port 8081 \
    >/tmp/saecula-metro.log 2>&1 &
  echo $! >/tmp/saecula-metro.pid
)
METRO_PID="$(cat /tmp/saecula-metro.pid)"
for _ in $(seq 1 90); do
  curl -sf http://127.0.0.1:8081/status >/dev/null 2>&1 && break
  sleep 1
done
curl -sf http://127.0.0.1:8081/status >/dev/null 2>&1 \
  || fail "Metro not up (see /tmp/saecula-metro.log)"
log "Metro ready; launching app"
adb shell "am start -n $APP_ID/.MainActivity" >/dev/null 2>&1 || true
sleep 5

# --- 6. Maestro flows ----------------------------------------------------------------
log "Running Maestro flows (apps/mobile/.maestro)"
maestro test "$ROOT/apps/mobile/.maestro"

log "E2E suite finished OK"
