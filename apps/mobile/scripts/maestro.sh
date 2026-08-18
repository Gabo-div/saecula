#!/usr/bin/env bash
set -euo pipefail

# Maestro runner for the mobile app — runs the Maestro flows against an
# Android device/emulator INDEPENDENTLY of the repo-wide e2e pipeline.
# Assumes the backend (:8080) and databases are already up and seeded; it only
# handles the device + app + Metro + Maestro steps.
#
# Usage (from apps/mobile):
#   bun run maestro            # dev build (expo run:android)
#   bun run maestro:expo       # Expo Go (no native build)
#
# Env:
#   E2E_RUNNER   devbuild (default) | expo
#   E2E_DEVICE   pin a specific adb device/serial
#   E2E_ANCHOR_DATE   seeded day the flows assert (default 2026-08-15)
#   EXPO_URL     Expo Go deep link override (default exp://<host LAN IP>:8081)

MOBILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$MOBILE/../.." && pwd)"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$ANDROID_HOME/platform-tools:$HOME/.maestro/bin:$HOME/.bun/bin:$PATH"

log() { printf '\n\033[1;34m[saecula-maestro]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[saecula-maestro] FAIL:\033[0m %s\n' "$*"; exit 1; }

ANCHOR_DATE="${E2E_ANCHOR_DATE:-2026-08-15}"
ANCHOR_YEAR="${ANCHOR_DATE%%-*}"
ANCHOR_MMDD="$(printf '%s%s' "${ANCHOR_DATE:5:2}" "${ANCHOR_DATE:8:2}")"   # 0815
ANCHOR_CCYY="${ANCHOR_DATE:0:4}"                                            # 2026
HOST_IP="$(ip -4 route get 8.8.8.8 2>/dev/null | sed -n 's/.*src \([0-9.]*\).*/\1/p')"
[ -n "$HOST_IP" ] || HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
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

ADB_CMD=(adb)
if [ -n "${E2E_DEVICE:-}" ]; then
  ADB_CMD=(adb -s "$E2E_DEVICE")
fi
adb() { command "${ADB_CMD[@]}" "$@"; }

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

expo_go_present() {
  adb_reconnect || return 1
  adb shell pm path host.exp.exponent 2>/dev/null | grep -q package: && return 0
  adb shell "pm list packages host.exp.exponent" 2>/dev/null | grep -q host.exp.exponent && return 0
  adb shell dumpsys package host.exp.exponent 2>/dev/null | grep -q "versionCode" && return 0
  return 1
}

METRO_PID=""
AUTOFILL_SAVED=""

cleanup() {
  if [ -n "$METRO_PID" ] && kill -0 "$METRO_PID" 2>/dev/null; then
    log "Stopping Metro (pid $METRO_PID)"
    kill "$METRO_PID" 2>/dev/null || true
  fi
  if [ -n "${AUTOFILL_SAVED:-}" ] && [ "$AUTOFILL_SAVED" != null ]; then
    adb_reconnect || true
    adb shell settings put secure autofill_service "$AUTOFILL_SAVED" >/dev/null 2>&1 || true
    adb shell am force-stop com.google.android.gms >/dev/null 2>&1 || true
    log "Restored Google autofill service"
  fi
  rm -f "$MOBILE/.maestro-pid"
}
trap cleanup EXIT INT TERM HUP

# --- 1. Device -------------------------------------------------------------------
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

# Disable Google autofill during the run (idempotent, restored in cleanup).
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

# --- 2. App install ----------------------------------------------------------------
if [ "$RUNNER" = expo ]; then
  log "Checking Expo Go (host.exp.exponent)"
  if expo_go_present; then
    log "Expo Go already installed — skipping"
  else
    EXPO_SDK="$(node -p "require('$MOBILE/package.json').dependencies.expo.replace(/\^|~/,'')")"
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
  # Build with the real Node, not `bun x`: bunx injects a `node`→bun shim early
  # in PATH, and gradle's `node -e` calls then print nothing, breaking the build
  # ("Cannot convert '' to File" in app/build.gradle).
  log "Building + installing the app (expo run:android, API=$API_URL)"
  (
    cd "$MOBILE"
    EXPO_PUBLIC_API_URL="$API_URL" npx --no-install expo run:android --variant debug --no-bundler
  )
fi

# --- 3. Metro bundler ---------------------------------------------------------------
if [ "$RUNNER" = expo ]; then
  METRO_FLAGS="--go"
else
  METRO_FLAGS=""
fi
log "Starting Metro dev server (port 8081) [$RUNNER]"
(
  cd "$MOBILE"
  EXPO_PUBLIC_API_URL="$API_URL" nohup bun --bun x expo start --port 8081 $METRO_FLAGS \
    >/tmp/saecula-metro.log 2>&1 &
  echo $! >"$MOBILE/.maestro-pid"
)
METRO_PID="$(cat "$MOBILE/.maestro-pid")"
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

# --- 4. Maestro flows ----------------------------------------------------------------
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
log "Running Maestro flows ($MOBILE/.maestro, $RUNNER)"
maestro test "${MAESTRO_ENV[@]}" "$MOBILE/.maestro"

log "Maestro suite finished OK"
