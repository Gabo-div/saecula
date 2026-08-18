# E2E — Plan de pruebas de la app completa (móvil nativa)

> Guía de trabajo. La app móvil es Expo/React Native **nativa** (sin target web):
> el E2E cubre el pipeline completo — docker-compose (BDs), `saecula-cli`
> (scrape/seed), `apps/back` (API) y la app en emulador/simulador.
> **No se trabaja sobre build web.**

## Herramientas elegidas

| Capa | Herramienta | Por qué |
|---|---|---|
| BDs + datos | docker-compose (Postgres + Neo4j) + `saecula-cli seed` | Infra ya existente; seed idempotente con datos reales |
| API `apps/back` | Tests **Go de integración** (`go test`) con el server real contra las BDs seedeadas | Sin Playwright ya, esta es la forma natural; mismo ecosistema Go |
| App móvil **nativa** | **Maestro** (flujos YAML) sobre emulador Android | E2E estándar para Expo/RN nativo, sin build pesada |

Alternativas a Maestro si más adelante se requiere: **Detox** (estándar RN, exige
build nativa + Jest) y **Appium** (genérico/WebDriver, más setup).

## Pasos

### 1. Infraestructura (BDs + datos)
- [x] `docker compose up -d --force-recreate` y esperar healthchecks (Postgres + Neo4j)
- [x] `go build` del CLI y seed con los datos reales:
      `seed --file data/bible_cee.json --file data/catechism_ccc_en.json
            --file data/catechism_ccc_es.json --file data/catechism_ccc_la.json
            --file data/readings_usccb.json --test-user`
- [x] `daily --fill` (verso del día) sobre `data/daily_feasts.json`

### 2. E2E de la API (Go, integración)
- [x] Suite de integración en `apps/back` (`integration_test.go`, server real vía `httptest` contra las BDs seedeadas; skips si no hay stack):
  - [x] `GET /health`
  - [x] `POST /auth/login` (test@saecula.app / saecula123) → JWT
  - [x] `GET /api/bible/books?lang=es`
  - [x] `GET /api/bible/GEN/1?lang=es`
  - [x] `GET /api/catechism/1`
  - [x] `GET /api/readings/{fecha fija seedeada}`
  - [x] `GET /api/bible/search` y `GET /api/catechism/search`

### 3. E2E móvil (Maestro)
- [x] Instalar CLI de Maestro (`curl -Ls https://get.maestro.mobile.dev | bash`) — hecho en este entorno: Maestro 2.8.0 + JDK 21 en espacio de usuario (`~/.local/jdk21`, `JAVA_HOME` y PATH en `~/.bashrc`)
- [x] Emulador Android (AVD / Android Studio) con la app instalada (`expo run:android` debug) o dev client
- [x] Apuntar la app al back del host: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8080` (emulador) en `.env` (lo inyecta `e2e.sh`)
- [x] Flujos `.maestro/*.yaml` (`apps/mobile/.maestro/`, helper `00_launch.yaml`):
  - [x] `auth.yaml` — login (credenciales malas → error; buenas → Home) y sign-out
  - [x] `home.yaml` — carrusel verso del día + catecismo del día (`CCC n`) + tarjeta de celebración + accesos rápidos
  - [x] `bible.yaml` — leer capítulo, picker libro/capítulo (Génesis→Mateo), buscar y saltar al versículo exacto
  - [x] `catechism.yaml` — párrafos cargan, salto por número (1422 → sección "La Penitencia y la Reconciliación"), búsqueda
  - [x] `readings.yaml` — calendario → lecturas del día, cambiar fecha (anclado a 2026-08-15, "hoy" = fecha local del dispositivo)
  - [x] `prayers.yaml` — oración individual con cambio EN/ES/LA + flujo del Rosario
  - [x] `chat.yaml` — Ask (chat AI): render + historial vacío + navegación de vuelta
  - [x] `settings.yaml` — tema/idioma/traducción; sign out cubierto en `auth.yaml`

### 4. Orquestación y docs
- [x] Script orquestador `scripts/e2e.sh` (compose + seed + back + fecha/locale emulador + build + maestro) y `bun run test:e2e` en el móvil
- [x] Sección E2E en el `README.md` raíz (prerequisitos: docker, go, bun, emulador Android, maestro; cómo correr)
- [x] Correr la suite completa en local (9/9 flujos verdes) y ajustar timeouts

## Pendiente / roadmap — E2E con Expo Go (`E2E_RUNNER=expo`)
- [ ] **Arreglar los tests E2E con Expo Go.** Hay soporte base (base `E2E_RUNNER=expo`, `HOST_IP`, `appId` parametrizado, `openLink`, `test:e2e:expo`), pero los flujos aún **no pasan** en Expo Go:
  - [ ] El **dev menu de Expo Go** aparece de forma intermitente (sobre login y sobre Home) y rompe los taps. El dismiss actual tocaba "Continue", que **abre** el menú en vez de cerrarlo — hay que cerrarlo tocando el **backdrop** (afuera, ~50%,5%). El `00_launch` debe descartarlo en login y tras el relanzamiento a Home.
  - [ ] El **autofill de Google** ("Use your saved password") se dispara al enfocar el campo password (hay credencial guardada de corridas previas). `e2e.sh` intenta deshabilitarlo (`autofill_service null` + force-stop GMS) pero es frágil (adb over red a Waydroid se cae). Verificar que el setting aplica antes de Maestro.
  - [ ] Tras login, los **quick actions de Home** (p.ej. "Oración") no navegan al tocar el texto (TextView `clickable=false`) en Expo Go.
  - [ ] La conexión `adb` por red (Waydroid `192.168.240.112:5555`) es inestable; el `adb_reconnect()` en `e2e.sh` es la mitigación. Confirmar estabilidad.
- Estado actual: `bun run test:e2e` (devbuild) es el camino verde; `bun run test:e2e:expo` queda **rojo** hasta resolver lo de arriba.

## Decisiones / riesgos
- **Volúmenes**: conservarlos entre corridas (el seed es idempotente); `docker compose down -v` para re-aplicar migraciones o datos limpios.
- **Endpoints "daily"**: dependen del reloj del server → assertions sobre **fechas fijas seedeadas** y aserción estructural en "hoy".
- **"Hoy" en el móvil = fecha local del dispositivo** (`client.todayLocalISO`), no UTC: `e2e.sh` ancla el reloj del emulador a `2026-08-15` y `readings.yaml` deriva el label esperado de ese ancla +1.
- **Build con `npx`, no `bun x`**: `bunx` inyecta un shim `node`→bun en PATH y gradle falla con "Cannot convert '' to File"; Metro sí corre con bun (`bun --bun x expo start`, node 18 es muy viejo para `metro.config.js`). `e2e.sh` exporta `ANDROID_HOME`/PATH.
- **Peer mismatch `react@19.1.0` / `react-dom@19.2.7`**: solo afecta a web; irrelevante para este plan (no usamos web).
- **Determinismo**: el seed con `--test-user` garantiza credenciales fijas (`test@saecula.app` / `saecula123`) para login por UI y por API.
