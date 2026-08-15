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
- [ ] `docker compose up -d --force-recreate` y esperar healthchecks (Postgres + Neo4j)
- [ ] `go build` del CLI y seed con los datos reales:
      `seed --file data/bible_cee.json --file data/catechism_ccc_en.json
            --file data/catechism_ccc_es.json --file data/catechism_ccc_la.json
            --file data/readings_usccb.json --test-user`
- [ ] `daily --fill` (verso del día) sobre `data/daily_feasts.json`

### 2. E2E de la API (Go, integración)
- [ ] Suite de integración en `apps/back` (package `internal/*` con `//go:build integration` o dir aparte) que levanta el server real contra las BDs seedeadas:
  - [ ] `GET /health`
  - [ ] `POST /auth/login` (test@saecula.app / saecula123) → JWT
  - [ ] `GET /api/bible/books?lang=es`
  - [ ] `GET /api/bible/GEN/1?lang=es`
  - [ ] `GET /api/catechism/1`
  - [ ] `GET /api/readings/{fecha fija seedeada}`
  - [ ] `GET /api/bible/search` y `GET /api/catechism/search`

### 3. E2E móvil (Maestro)
- [ ] Instalar CLI de Maestro (`curl -Ls https://get.maestro.mobile.dev | bash`)
- [ ] Emulador Android (AVD / Android Studio) con la app instalada (`bun --bun x expo run:android`) o dev client
- [ ] Apuntar la app al back del host: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8080` (emulador) en `.env`
- [ ] Flujos `.maestro/*.yaml`:
  - [ ] `auth.yaml` — login (credenciales malas → error; buenas → Home) y sign-out
  - [ ] `home.yaml` — verso del día + tarjeta de celebración + accesos rápidos
  - [ ] `bible.yaml` — leer capítulo, picker libro/capítulo, buscar y saltar
  - [ ] `catechism.yaml` — párrafos cargan, salto por número, búsqueda
  - [ ] `readings.yaml` — calendario → lecturas del día, cambiar fecha (anclado a fecha fija seedeada)
  - [ ] `prayers.yaml` — oración individual con cambio EN/ES/LA + flujo del Rosario
  - [ ] `settings.yaml` — tema/acento/idioma/traducción persisten; sign out

### 4. Orquestación y docs
- [ ] Script orquestador (p.ej. `scripts/e2e.sh`: compose + seed + back + maestro) y `npm run test:e2e` en el móvil si aplica
- [ ] Sección E2E en el `README.md` raíz (prerequisitos: docker, go, bun, emulador Android, maestro; cómo correr)
- [ ] Correr la suite completa en local y ajustar timeouts

## Decisiones / riesgos
- **Volúmenes**: conservarlos entre corridas (el seed es idempotente); `docker compose down -v` para re-aplicar migraciones o datos limpios.
- **Endpoints "daily"**: dependen del reloj del server → assertions sobre **fechas fijas seedeadas** y aserción estructural en "hoy".
- **Peer mismatch `react@19.1.0` / `react-dom@19.2.7`**: solo afecta a web; irrelevante para este plan (no usamos web).
- **Determinismo**: el seed con `--test-user` garantiza credenciales fijas (`test@saecula.app` / `saecula123`) para login por UI y por API.
