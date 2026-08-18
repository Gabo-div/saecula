#!/usr/bin/env bash
set -euo pipefail

# Saecula E2E orchestrator — full pipeline: docker-compose (Postgres + Neo4j),
# saecula-cli seed, the Go backend, and the Maestro flows against an Android
# emulator. See README "End-to-end testing (E2E)".

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$ANDROID_HOME/platform-tools:$HOME/.maestro/bin:$HOME/.bun/bin:$PATH"

log() { printf '\n\033[1;34m[saecula-e2e]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[saecula-e2e] FAIL:\033[0m %s\n' "$*"; exit 1; }

# The seeded day the suite is anchored to. Keep in sync with the flows.
ANCHOR_DATE="${E2E_ANCHOR_DATE:-2026-08-15}"
ANCHOR_YEAR="${ANCHOR_DATE%%-*}"
ANCHOR_MMDD="$(printf '%s%s' "${ANCHOR_DATE:5:2}" "${ANCHOR_DATE:8:2}")"   # 0815
ANCHOR_CCYY="${ANCHOR_DATE:0:4}"                                            # 2026
# IP the host reaches the rest of its network through (wlan0/eth0). Used for
# both Expo Go's exp:// URL and the backend API URL — the 10.0.2.2 alias only
# exists inside the classic Android AVD, not on Waydroid/physical/adb devices.
HOST_IP="$(ip -4 route get 8.8.8.8 2>/dev/null | sed -n 's/.*src \([0-9.]*\).*/\1/p')"
[ -n "$HOST_IP" ] || HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
# How the app runs on the emulator: "devbuild" (expo run:android debug build,
# installed as com.saecula.app) or "expo" (Expo Go opened via its exp:// URL —
# no native build needed). Override with E2E_RUNNER.
RUNNER="${E2E_RUNNER:-devbuild}"
case "$RUNNER" in
  devbuild|expo) ;;
  *) fail "E2E_RUNNER must be 'devbuild' or 'expo' (got '$RUNNER')" ;;
esac
if [ "$RUNNER" = expo ]; then
  APP_ID="host.exp.exponent"
  EXPO_URL="${EXPO_URL:-exp://${HOST_IP}:8081}"
else
  APP_ID="com.saecula.app"
  EXPO_URL=""
fi
API_URL="${EXPO_PUBLIC_API_URL:-http://${HOST_IP}:8080}"

# Pin every adb call to one device when E2E_DEVICE is set; otherwise target
# whatever adb picks (the verifier in step 4 guarantees that's unambiguous).
ADB_CMD=(adb)
if [ -n "${E2E_DEVICE:-}" ]; then
  ADB_CMD=(adb -s "$E2E_DEVICE")
fi
adb() { command "${ADB_CMD[@]}" "$@"; }

# adb_reconnect brings the (possibly network) target back if the transport
# dropped. Returns 0 when a device is reachable. $ADB_TARGET is the serial to
# `adb connect` (empty = only local/adb-listed devices).
ADB_TARGET=""
adb_reconnect() {
  for _ in 1 2 3; do
    if adb get-state >/dev/null 2>&1; then
      return 0
    fi
    if [ -n "$ADB_TARGET" ]; then
      adb connect "$ADB_TARGET" >/dev/null 2>&1 || true
      sleep 1
    else
      return 1
    fi
  done
  return 1
}

# expo_go_present reports whether Expo Go (host.exp.exponent) is installed on
# the target device. Tries several adb queries because `pm path` alone returns
# nothing for packages present in a secondary user profile.
expo_go_present() {
  adb_reconnect || return 1
  adb shell pm path host.exp.exponent 2>/dev/null | grep -q package: && return 0
  adb shell "pm list packages host.exp.exponent" 2>/dev/null | grep -q host.exp.exponent && return 0
  adb shell dumpsys package host.exp.exponent 2>/dev/null | grep -q "versionCode" && return 0
  return 1
}

BACK_PID=""
METRO_PID=""
AUTOFILL_SAVED=""

cleanup() {
  if [ -n "$BACK_PID" ] && kill -0 "$BACK_PID" 2>/dev/null; then
    log "Stopping the backend (pid $BACK_PID)"
    kill "$BACK_PID" 2>/dev/null || true
  fi
  if [ -n "$METRO_PID" ] && kill -0 "$METRO_PID" 2>/dev/null; then
    log "Stopping Metro (pid $METRO_PID)"
    kill "$METRO_PID" 2>/dev/null || true
  fi
  # Restore Google autofill so the device is left exactly as it was found.
  if [ -n "${AUTOFILL_SAVED:-}" ] && [ "$AUTOFILL_SAVED" != null ]; then
    adb_reconnect || true
    adb shell settings put secure autofill_service "$AUTOFILL_SAVED" >/dev/null 2>&1 || true
    adb shell am force-stop com.google.android.gms >/dev/null 2>&1 || true
    log "Restored Google autofill service"
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

# --- 4. Emulator -----------------------------------------------------------------
# Verify the Android target: exactly one device attached, or E2E_DEVICE pins one.
if [ -n "${E2E_DEVICE:-}" ]; then
  adb get-state >/dev/null 2>&1 \
    || fail "E2E_DEVICE=$E2E_DEVICE is not connected/authorized — run 'adb devices'"
  log "Using device $E2E_DEVICE"
else
  READY="$(adb devices | awk 'NR>1 && $2=="device" {print $1}' 2>/dev/null || true)"
  TOTAL="$(printf '%s\n' "$READY" | sed '/^$/d' | wc -l | tr -d ' ')"
  case "$TOTAL" in
    1) log "Using the only attached device" ;;
    0) fail "no emulator/device attached (start an AVD first)" ;;
    *)
      log "Multiple Android targets attached:"
      printf '%s\n' "$READY" | sed 's/^/    /'
      fail "multiple devices attached — set E2E_DEVICE=<serial> to pick one"
      ;;
  esac
fi
# Waydroid/physical targets connect over the network and the adb transport can
# drop, but unlike an emulator it does NOT reconnect on its own — an explicit
# `adb connect` is required. Record the serial so later commands can re-attach.
if [ -n "${E2E_DEVICE:-}" ]; then
  ADB_TARGET="$E2E_DEVICE"
else
  ADB_TARGET="$READY"
fi
adb_reconnect || true
log "Pinning emulator clock to $ANCHOR_DATE and locale to es-ES"
adb root >/dev/null 2>&1 || true
adb shell "settings put global auto_time 0" >/dev/null 2>&1 || true
adb shell "date ${ANCHOR_MMDD}1200${ANCHOR_CCYY}.00" >/dev/null 2>&1 \
  || adb shell "date -s $(date -d "$ANCHOR_DATE" +%Y%m%d.1200)" >/dev/null 2>&1 \
  || log "WARNING: could not set the emulator clock — flows need the device on $ANCHOR_DATE"
adb shell "settings put system system_locales es-ES" >/dev/null 2>&1 || true
adb shell "am force-stop $APP_ID" >/dev/null 2>&1 || true
# Disable Google autofill during the run so the login flow's credential picker
# ("Use your saved password") and silent form autofill don't interfere.
# Idempotent and reversible: the original autofill_service value is saved, then
# set to null and GMS is restarted so it reloads the config (the service keeps
# running with its old settings otherwise). Each step is verified and retried a
# couple of times, because the network adb transport can drop a command
# silently. cleanup() restores the original value.
adb_reconnect || true
AUTOFILL_SAVED="$(adb shell settings get secure autofill_service 2>/dev/null || true)"
if [ -n "$AUTOFILL_SAVED" ] && [ "$AUTOFILL_SAVED" != null ]; then
  set_autofill_null() {
    for _ in 1 2 3; do
      adb_reconnect || return 1
      adb shell settings put secure autofill_service null >/dev/null 2>&1 || true
      adb shell am force-stop com.google.android.gms >/dev/null 2>&1 || true
      sleep 1
      GOT="$(adb shell settings get secure autofill_service 2>/dev/null || true)"
      [ "$GOT" = "null" ] && return 0
    done
    return 1
  }
  if set_autofill_null; then
    log "Google autofill disabled for this run (restored afterwards)"
  else
    log "WARNING: could not disable Google autofill — login flow may see its picker"
  fi
fi

# --- 5. App install ---------------------------------------------------------------
if [ "$RUNNER" = expo ]; then
  # Expo Go: no native build. Install the APK matching the app's SDK only when
  # Expo Go is genuinely missing; an already-installed newer build is kept as-is
  # (an older resolved APK must never downgrade it). The bundle is served by
  # Metro (step 5b).
  log "Checking Expo Go (host.exp.exponent)"
  if expo_go_present; then
    log "Expo Go already installed — skipping"
  else
    EXPO_SDK="$(node -p "require('$ROOT/apps/mobile/package.json').dependencies.expo.replace(/\^|~/,'')")"
    EXPO_GO_URL="$(curl -sf https://api.expo.dev/v2/versions \
      | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const v=JSON.parse(d);const s=process.argv[1];const sdk=v.sdkVersions[s]||v.sdkVersions[Object.keys(v.sdkVersions).at(-1)];console.log(sdk?.androidClientUrl||'')})" "$EXPO_SDK")"
    [ -n "$EXPO_GO_URL" ] || fail "could not resolve an Expo Go APK URL for expo ^$EXPO_SDK"
    curl -sfL "$EXPO_GO_URL" -o /tmp/expo-go.apk || fail "could not download Expo Go APK"
    INSTALL_OUT="$(adb install -r /tmp/expo-go.apk 2>&1)" || true
    if printf '%s' "$INSTALL_OUT" | grep -qi "VERSION_DOWNGRADE"; then
      log "Expo Go is already installed (newer than the resolved APK) — skipping"
    elif printf '%s' "$INSTALL_OUT" | grep -qi "Success"; then
      log "Expo Go installed from $EXPO_GO_URL"
    else
      fail "could not install Expo Go: $INSTALL_OUT"
    fi
  fi
else
  # Build with the real Node, not `bun x`: bunx injects a `node`→bun shim early in
  # PATH, and gradle's `node -e` calls then print nothing, breaking the build
  # ("Cannot convert '' to File" in app/build.gradle).
  log "Building + installing the app (expo run:android, API=$API_URL)"
  (
    cd "$ROOT/apps/mobile"
    EXPO_PUBLIC_API_URL="$API_URL" npx --no-install expo run:android --variant debug --no-bundler
  )
fi

# --- 5b. Metro bundler ---------------------------------------------------------------
if [ "$RUNNER" = expo ]; then
  METRO_FLAGS="--go"   # serve the bundle for Expo Go explicitly
else
  METRO_FLAGS=""
fi
log "Starting Metro dev server (port 8081) [$RUNNER]"
(
  cd "$ROOT/apps/mobile"
  EXPO_PUBLIC_API_URL="$API_URL" nohup bun --bun x expo start --port 8081 $METRO_FLAGS \
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
if [ "$RUNNER" = expo ]; then
  adb shell "am start -a android.intent.action.VIEW -d '$EXPO_URL'" >/dev/null 2>&1 || true
else
  adb shell "am start -n $APP_ID/.MainActivity" >/dev/null 2>&1 || true
fi
sleep 5

# --- 6. Maestro flows ----------------------------------------------------------------
# Re-verify (and re-apply) the autofill-off state right before Maestro, since
# the intermediate steps (Metro, warm-up launch) could have disturbed it.
if [ "$RUNNER" = expo ] && [ -n "$AUTOFILL_SAVED" ] && [ "$AUTOFILL_SAVED" != null ]; then
  CUR="$(adb shell settings get secure autofill_service 2>/dev/null || true)"
  if [ "$CUR" != "null" ]; then
    log "Re-disabling Google autofill before Maestro (was: $CUR)"
    set_autofill_null && log "Google autofill re-disabled" \
      || log "WARNING: could not re-disable Google autofill"
  fi
fi
MAESTRO_ENV=(-e "APP_ID=$APP_ID" -e "RUNNER=$RUNNER")
if [ "$RUNNER" = expo ]; then
  MAESTRO_ENV+=(-e "EXPO_URL=$EXPO_URL")
fi
log "Running Maestro flows (apps/mobile/.maestro, $RUNNER)"
maestro test "${MAESTRO_ENV[@]}" "$ROOT/apps/mobile/.maestro"

log "E2E suite finished OK"
