# Saecula

A Catholic study and historical application where everything — Bible verses,
Catechism paragraphs, Saints, Councils, Dogmas, and Historical Events — is
connected via a knowledge graph and mapped onto a master chronological
timeline.

## Core architectural principle: concept–text separation

Saecula supports multiple languages and historical text editions without ever
duplicating structural relationships, via a strict dual-database pattern:

| Store | Role | Contents |
|---|---|---|
| **Neo4j** | Language-agnostic **Concept Graph** | Objective historical realities, temporal placement (`start_year`/`end_year`/`era`), theological connections. **No long-form body text.** |
| **PostgreSQL** | Localized **Translation Store** | Multilingual text payloads keyed by `(entity_id, language_code, translation_id)`. |

The two stores are joined by a universal alphanumeric slug, the `entity_id`
(e.g. `JHN.3.16`, `CCC.1422`, `COUNCIL.NICEA.I`), which is the `id` property
of every Neo4j node and the first component of the composite primary key in
PostgreSQL's `text_documents` table.

## Monorepo layout

```
saecula/
├── apps/
│   ├── back/       # Go REST API (chi) — modular APIs, DI composition root
│   ├── cli/        # Go CLI (cobra) — scrape → generic JSON, seed as a separate step
│   ├── mobile/     # React Native app (Expo + TypeScript, Tamagui v2, Zustand, Axios)
│   └── thesis/     # Thesis proposal sources + JS tool to render them to Word
├── packages/
│   ├── config/     # Shared TS/ESLint/Prettier configs (@saecula/config)
│   └── contracts/  # Shared API contract types (@saecula/contracts) — single source of truth
├── libs/
│   └── canon/      # Shared Go module: canonical catalog of the 73 books
├── scripts/
│   ├── e2e.sh      # Repo-wide E2E orchestrator (compose + seed + back → delegates Maestro)
│   └── go-test.sh  # Runs the Go test suites across back + cli
├── package.json    # bun workspaces + Turborepo root
├── turbo.json      # Turborepo task pipeline
├── bun.lock        # single lockfile for all JS/TS workspaces
├── go.work         # Go workspace tying back + cli + canon together
└── README.md
```

### Tooling

- **bun** — the package manager and script runner. One `bun.lock` at the root
  covers every `apps/*` and `packages/*` workspace; `bun install` at the root
  links them.
- **Turborepo** — task pipeline (`build`, `typecheck`, `lint`, `format`,
  `test`, `dev`) with caching and parallelism: `bun run typecheck`,
  `bun run lint`, `bun run test`.
- **Go workspace** (`go.work`) — ties `apps/back`, `apps/cli` and `libs/*`
  together for `go build`/`go test`.
- **Extra Go tools** — `bun run dev` needs [`air`](https://github.com/air-verse/air)
  (backend hot reload) and `bun run lint` needs
  [`golangci-lint`](https://golangci-lint.run) v2 (config in `.golangci.yml`).
  Install both with `go install` (they land in `$(go env GOPATH)/bin`, which
  must be on `PATH`).

Common commands from the repo root:

```bash
bun install           # install + link all workspaces
bun run typecheck     # tsc across @saecula/contracts and the mobile app
bun run lint          # golangci-lint (back + cli) + eslint (mobile)
bun run format        # gofmt (back + cli) + eslint --fix (mobile)
bun run test          # turbo test + go test (back + cli)
bun run e2e           # full pipeline: compose + seed + back + Maestro (dev build)
bun run e2e --expo    # same, with the app running in Expo Go
```

The mobile app's Maestro runner is **independent** — from `apps/mobile`:

```bash
bun run maestro          # device + app + Metro + Maestro flows (dev build)
bun run maestro --expo   # same, using Expo Go (no native build)
bun run maestro:expo     # shorthand for `bun run maestro --expo`
```

Both scripts accept `--dev` / `--expo` flags (they override `E2E_RUNNER`); the
`*:expo` package scripts are just convenience aliases that set
`E2E_RUNNER=expo`.

`scripts/e2e.sh` (the repo-wide orchestrator) brings up the infrastructure
(databases, seed, backend) and then **delegates** the device/Metro/Maestro
phase to `apps/mobile/scripts/maestro.sh`, so the mobile suite can be run on
its own without the full pipeline.

## Dependency injection

Both Go apps follow constructor injection everywhere:

- **Backend** — `main.go` is the single composition root. Infrastructure
  (`pgxpool.Pool`, Neo4j driver) is built once and injected into
  repositories (`auth.UserRepository`, `timeline.GraphRepository`,
  `timeline.TextRepository`), which are injected as **interfaces** into the
  API handlers. The HTTP server receives fully-built `server.API` modules —
  adding a new API is: implement `Pattern() + Routes()`, add one line in
  `main.go`. No globals, no singletons.
- **CLI** — the scraper receives an injected `Fetcher` (swappable for
  fixtures/caching); the seeder receives `TextStore` and `GraphStore`
  interfaces whose Postgres/Neo4j implementations are wired in the command
  layer. Document→store mapping is pure and unit-testable.

## Getting started

### 1. Start the databases

```bash
docker compose up -d
```

- PostgreSQL on `localhost:5432` (user `saecula`, password `saecula_dev_password`, db `saecula`).
  The schema in `apps/back/migrations/` runs automatically on first boot.
- Neo4j on `bolt://localhost:7687`, browser UI at <http://localhost:7474>
  (user `neo4j`, password `saecula_dev_password`).

### 2. Run the backend

```bash
cd apps/back
go mod tidy
go run .
```

The API listens on `:8080`. Configuration is environment-driven
(`HTTP_ADDR`, `POSTGRES_DSN`, `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`,
`JWT_SECRET`, `JWT_EXPIRATION`); defaults match docker-compose. The chat
assistant is enabled only when `GEMINI_API_KEY` is set — with `CHAT_MODEL`
(default `googleai/gemini-flash-latest`), `CHAT_MAX_TOOL_ITERS`,
`CHAT_MAX_OUTPUT_TOKENS` and `CHAT_RATE_PER_MIN` as the tuning knobs.

### 3. Scrape and seed data

**Interactive mode** — running `saecula-cli` with no arguments in a
terminal (or `saecula-cli interactive`) starts a guided wizard (scrape or
seed, multiselect of files, connection prompts). It uses the terminal's
own color scheme and drives the same code paths as the flag-based
commands below.

The CLI is a two-stage pipeline with a strict separation:

**Stage 1 — scrape (default command, no database involved).** Downloads
the **complete CEE Bible** (`conferenciaepiscopal.es/biblia`, Sagrada
Biblia de la Conferencia Episcopal Española, 2011) into **one generic JSON
document**: 73 books → chapters → verses.

```bash
cd apps/cli
go mod tidy

go run . scrape --out data/bible_cee.json
```

Books are identified by the **canonical catalog** (`libs/canon`, a shared
Go module used by both the CLI and the backend): USFM codes (`GEN`, `JHN`,
`1CO`…) and shared English slugs (`genesis`, `john`, `1-corinthians`…)
that are identical for every Bible source — each source only maps its own
URLs onto the catalog (see `ceeSlugByCode` in `internal/scrape/cee.go`).
Composition years and era per book also come from the catalog. Adding a
new Bible source = one scraper that maps its pages to the same catalog.

**Stage 2 — seed (separate command).** Loads generic JSON documents
(scraped or handwritten — see `data/` samples) into both stores:

```bash
go run . seed --file data/bible_cee.json
go run . seed --file data/sample_john_3.json --file data/sample_catechism.json
```

Seeding is idempotent: PostgreSQL texts upsert via `ON CONFLICT`, Neo4j
nodes and relationships via `MERGE`.

**Basic seed + test login.** `--test-user` seeds the dev account
`test@saecula.app` / `saecula123` (Postgres only, no Neo4j needed). Combine
with a data file for a one-shot basic setup, or run it alone:

```bash
go run . seed --file data/bible_cee.json --test-user   # basic data + login
go run . seed --test-user                              # just the login
```

**Verse & image of the day.** `daily` upserts curated rows into
`daily_features` (Postgres); the backend serves them instead of the built-in
rotation, falling back per-date when absent. A verse may be one reference or a
same-chapter range. `data/daily_feasts.json` covers the major fixed feasts (its
`MM-DD` dates apply to `--year`); the rest of the year uses the fallback.

```bash
go run . daily --file data/daily_feasts.json --year 2026 --fill  # every day of 2026
go run . daily --file data/daily_feasts.json --year 2026         # feasts only
go run . daily --date 2026-08-06 --verse MAT.17.2 --image https://…
```

`--fill` seeds all 365 days: feast days from the file, every other day from a
built-in verse rotation pool.

### 4. Run the mobile app

UI built with **Tamagui v2** (React 19 + React Native 0.81 / Expo SDK 54,
New Architecture; config preset `@tamagui/config/v5`, babel plugin for
compile-time optimization), navigation with React Navigation bottom tabs,
state with Zustand, HTTP with Axios, i18n with **i18next/react-i18next**
(`src/i18n/` — English, Spanish and Ecclesiastical Latin UI locales; the
first launch follows the device language via `expo-localization`, and the
persisted language switcher drives both the UI locale and the `?lang=`
content parameter from a single store). Translation keys are typed against
the English reference locale — a typo in `t('...')` is a compile error.

Five tabs in a liturgical theme (mode × accent):

- **Home** — daily rotating sacred-art background (public-domain works
  from Wikimedia Commons picked by day of year) with the verse of the day,
  quick actions and a highlighted card for the day's celebration and saint.
- **Bible** — full reader: book + version picker (from `/api/bible`),
  chapter grid, verse-numbered text, prev/next chapter navigation that
  crosses book boundaries. Reading position persists across launches.
- **Catechism** — infinite-scroll reader of the numbered CCC paragraphs
  (from `/api/catechism`).
- **Explore** — placeholder for the chronological timeline (see Roadmap).
- **Calendar** — a hub of dated sections: daily Mass readings (with a date
  picker), the santoral (saints by month), and celebrations (the liturgical
  year by month, each tappable for a detail sheet linking to its readings),
  all from `/api/readings` and `/api/calendar`.
- **Ask** — AI chat tab (streaming thread, tool calls with friendly labels, a
  details sheet with model + tools + references, suggested questions, a
  floating input with a bottom fade, and per-message actions).

Profile/settings (theme, accent, language, translation) is reached from a
button in the Home header, not a tab. **Prayers** are opened the same way
(Home header / quick action): a hub of individual prayers — each on its own
page with an EN/ES/LA selector — and a full-screen, step-by-step guided
Rosary that walks the day's mysteries bead by bead.

```bash
cd apps/mobile
bun install
bun run start
```

The backend URL comes from `.env` (`EXPO_PUBLIC_API_URL`, default
`http://localhost:8080` — copy `.env.example` to `.env` and adjust).
`localhost` works for web and the iOS simulator; the Android emulator (AVD)
needs `http://10.0.2.2:8080`; a physical device or Waydroid (Expo Go) needs
your machine's LAN IP, e.g. `http://192.168.1.9:8080` (the `e2e.sh`
orchestrator detects this automatically). Expo inlines the
variable at bundle time, so **restart `expo start` after editing `.env`**.
Every request is logged to the Metro/browser console in dev
(`[api] → …` / `[api] ← …`).

## End-to-end testing (E2E)

The E2E suite drives the **full native pipeline** — docker-compose databases,
`saecula-cli` seed, the Go backend, and the app on an Android emulator — with
**Maestro** flows (`apps/mobile/.maestro/*.yaml`). No web build involved.

### Prerequisites

- Docker, Go, Bun, and the Maestro CLI (`curl -Ls https://get.maestro.mobile.dev | bash`)
- An Android emulator (AVD) running and booted, with `adb` on `PATH`

### Running

**Full pipeline (infra + Maestro)** — from the repo root:

```bash
bun run e2e            # compose + seed + back + emulator + maestro (dev build)
bun run e2e --expo     # same, but run the app inside Expo Go (no native build)
```

**Maestro only** — from `apps/mobile` (assumes the backend and databases are
already up):

```bash
bun run maestro          # device + app + Metro + Maestro flows (dev build)
bun run maestro --expo   # same, but run the app inside Expo Go
```

The `maestro` runner is self-contained and independent; the repo-wide
`scripts/e2e.sh` orchestrator brings up the infrastructure (databases, seed,
backend) and then **delegates** the device/Metro/Maestro phase to
`apps/mobile/scripts/maestro.sh`.

The default runner is a **dev build**: the app is installed via
`expo run:android` and the backend URL for the emulator is inlined as
`EXPO_PUBLIC_API_URL=http://10.0.2.2:8080`.

Set `E2E_RUNNER=expo` to run the same Maestro flows against **Expo Go**
instead: the orchestrator skips the native build, installs Expo Go
(`host.exp.exponent`) on the emulator if needed, and opens the project via its
`exp://` URL; Metro still serves the bundle and the API URL.

The orchestrator auto-detects the host's LAN IP (`ip route get 8.8.8.8`, e.g.
`192.168.1.9`) and uses it for both Expo Go (`exp://<host>:8081`) and the
backend API URL (`http://<host>:8080`) — this works on Waydroid, physical
devices and adb targets, not just the classic AVD (whose `10.0.2.2` alias is
only reachable from inside that AVD). Override with `EXPO_URL` and
`EXPO_PUBLIC_API_URL`.

The orchestrator needs exactly **one** Android target. Set `E2E_DEVICE=<serial>`
to pin a specific device/emulator when several are attached (`adb devices` for
the serial); otherwise it fails and lists them.

The orchestrator (`scripts/e2e.sh`) does, in order:

1. Starts Postgres + Neo4j (`docker compose up -d`) and waits for health.
2. Seeds the databases idempotently: the CEE Bible, the Catechism in
   EN/ES/LA, the USCCB readings, the daily features, and the test account
   `test@saecula.app` / `saecula123` (`--test-user`).
3. Builds and starts the backend on `:8080` (it is stopped on exit).
4. Delegates the device/app/Metro/Maestro phase to
   `apps/mobile/scripts/maestro.sh`, which:
   - verifies the Android target (single device or `E2E_DEVICE`) and pins the
     **emulator clock** to the seeded anchor date (default `2026-08-15`) and
     the locale to `es-ES`;
   - installs the app: `expo run:android` (dev build) or Expo Go when
     `E2E_RUNNER=expo`;
   - starts Metro and runs `maestro test apps/mobile/.maestro`.

### Anchored date

The flows assert content that must be **seeded**: the 2026-08-15 Mass readings
(Assumption), the Prologue of the Catechism, paragraph 1422, etc. The suite is
therefore pinned to the seeded day in two places:

- the **server clock** (host) — feeds `/api/bible/daily` and `/api/calendar/daily`
  on Home;
- the **emulator clock** — feeds the readings screen's "today" (the app resolves
  it from the device's **local** date via `client.todayLocalISO`) and the
  date-picker month. The orchestrator sets it via `adb shell date` (needs
  `adb root`, standard on AVDs).

Change `E2E_ANCHOR_DATE` (and re-seed) to move the suite to a different day.
Individual flows are self-contained: each logs in with the seeded account when
needed and forces the Spanish UI language, so they can also be run alone, e.g.:

```bash
maestro test apps/mobile/.maestro/readings.yaml                    # dev build (default)
maestro test -e APP_ID=host.exp.exponent -e RUNNER=expo \
  -e EXPO_URL=exp://192.168.1.9:8081 apps/mobile/.maestro/readings.yaml  # Expo Go
```

### Flow coverage and visualization objectives

Each flow is self-contained (it boots the app, logs in with the seeded account
and forces Spanish) and asserts that its page/section **renders the expected
content** — the goal is to catch anything that stops a screen from displaying.
The suite is anchored to the seeded day `2026-08-15` (Assumption); the
readings flow derives its expected "next day" label from that anchor + 1 day,
matching how the app resolves "today" from the device's local date.

| Flow | Page / section | Visualization objective (what it asserts renders) |
|---|---|---|
| `00_launch` | Bootstrap | The app cold-starts to the login screen, the seeded account signs in, the UI language is forced to Spanish, and Home shows its header (`Inicio`). Shared by every other flow. |
| `auth` | Login + Profile | Sign-in lands on Profile showing the account (`test@saecula.app`), sign-out returns to the login screen, wrong credentials display the backend error, and correct credentials land back on Home. |
| `home` | Home + carousel + quick actions + tab bar | Home renders the verse-of-the-day and catechism-of-the-day carousel pages (swiping between them shows the `CCC n` reference), the celebration-of-the-day card, and the quick actions (`Preguntar`, `Oración`); the prayers hub opens from the quick action, and the tab bar navigates Home ↔ Calendar. |
| `bible` | Bible reader | A chapter renders with its location header, the book/chapter picker opens `Génesis 2` and `Mateo 5`, and full-text search shows results and jumps to the exact verse (Juan 19,25), which renders after the chrome compacts. |
| `catechism` | Catechism reader | The Prologue section renders, and searching `1422` jumps to its section (`La Penitencia y la Reconciliación`) with the penance text visible. |
| `chat` | Ask (AI chat) + history | The `Preguntar` quick action opens the chat with its `Preguntar` header, the history screen renders (`Historial`, empty after a fresh boot), and back navigation returns Home. Sending a message needs a `GEMINI_API_KEY`, so the flow only asserts rendering. |
| `prayers` | Prayers hub + prayer + guided Rosary | The hub renders (`Oraciones guiadas`), an individual prayer's body switches EN → LA (`Our Father` → `Pater Noster`), and the guided Rosary renders its start button and first step (`Señal de la Cruz`). |
| `readings` | Calendar hub → daily readings | The hub renders (`Lecturas del día`, `Santoral`), the day's readings scroll through First/Second reading and Gospel, the date picker opens anchored to August 2026 and jumps to "today", and the next/prev day steppers update the fixed date header. |
| `settings` | Profile + Settings | Profile renders the account, Settings renders theme/accent/language/translation rows, the theme modes (AMOLED/Claro/Oscuro) switch, the language switcher persists (Español ↔ English), and back navigation returns to Home. |

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | `{email, password}` → JWT + user |
| `POST` | `/auth/login` | — | `{email, password}` → JWT + user |
| `GET` | `/api/timeline` | Bearer | Hybrid graph+text query (below) |
| `GET` | `/api/bible/books?lang=` | Bearer | Canonical catalog + seeded chapter counts, localized names |
| `GET` | `/api/bible/{book}/{chapter}?lang=&translation=` | Bearer | One chapter's verses; `{book}` is a USFM code (`JHN`) or slug (`john`) |
| `GET` | `/api/bible/translations` | Bearer | Available editions in the translation store |
| `GET` | `/api/bible/daily?lang=&translation=` | Bearer | Verse (or range) + image of the day; curated `daily_features` row, else built-in rotation |
| `GET` | `/api/readings/{daily,date}?lang=&translation=` | Bearer | Day's Mass readings: citations + localized verse text |
| `GET` | `/api/calendar/{daily,date}?lang=` | Bearer | Liturgical day (santoral + temporal cycle) |
| `GET` | `/api/calendar/year/{year}?lang=` | Bearer | Whole gregorian year of the General Roman calendar |
| `GET` | `/api/catechism?lang=&from=&limit=` | Bearer | Paginated CCC paragraphs (English) |
| `GET` | `/api/catechism/{number}?lang=` | Bearer | One CCC paragraph |
| `POST` | `/api/chat` | Bearer | Streaming chat (SSE: token, tool_start, tool_end, done, error) |
| `GET` | `/api/chat/conversations` | Bearer | List the user's conversations |
| `GET` | `/api/chat/conversations/{id}` | Bearer | One conversation + messages (metadata: model, tool calls) |
| `DELETE` | `/api/chat/conversations/{id}` | Bearer | Delete a conversation |
| `GET` | `/health` | — | Liveness probe |

New APIs implement the `server.API` interface (`Pattern()`, `Routes()`) and
are registered in `main.go` as public (own mount point) or protected
(mounted under `/api` behind the JWT middleware).

### The hybrid timeline query

```
GET /api/timeline?start_year=-100&end_year=451&lang=es&translation=jerusalem_1976
Authorization: Bearer <token>
```

1. **Neo4j** — fetch every concept node whose lifespan overlaps
   `[start_year, end_year]` (negative years = BC), ordered chronologically.
2. **PostgreSQL** — bulk-fetch the localized `raw_content` for all returned
   `entity_id`s in the requested `lang` (optionally pinned to a specific
   `translation` edition), then join in memory.

Nodes with no translation in the requested language still appear on the
timeline — only their `text` field is absent.

## Graph schema (Neo4j)

All nodes carry the global temporal properties `start_year` (integer,
negative = BC), `end_year` (integer), and `era` (e.g. `"Patristic"`,
`"Medieval"`).

| Label | Own properties |
|---|---|
| `Verse` | `id`, `book`, `chapter`, `number` |
| `Saint` | `id`, `name_en`, `name_es`, `name_la`, `is_doctor` |
| `PatristicDocument` | `id`, `title_en`, `title_es` |
| `CatechismParagraph` | `id`, `official_number` |
| `Council` | `id`, `name_en`, `name_es`, `location` |
| `Dogma` | `id`, `name_en`, `name_es`, `short_definition_es` |
| `HistoricalEvent` | `id`, `title_en`, `title_es` |

Relationships created by the seeder so far: `(:Verse)-[:FOLLOWS]->(:Verse)`
(canonical order) and `(:CatechismParagraph)-[:CITES]->(:Verse)`.

Relationships pending (needed for `graph_related` and cross-reference
queries): `(:Saint)-[:READS]->(:Verse)`, `(:Council)-[:DEFINES]->(:Dogma)`,
and Catechism footnote cross-references.

## Relational schema (PostgreSQL)

- `users(id UUID PK, email UNIQUE, password_hash, created_at)`
- `text_documents(entity_id, language_code, translation_id, raw_content, metadata JSONB)`
  with composite `PRIMARY KEY (entity_id, language_code, translation_id)`
- `daily_features(feature_date PK, verse_ids TEXT[], image_url)` — curated
  verse (or range) and background image per date; seeded via `saecula-cli daily`

## Roadmap

Shipped: Bible reader, daily Mass readings, santoral, celebrations (with
tap-through detail), the Catechism in English/Spanish/Latin (Bible-style
reader with a collapsible section picker and a translation switch), an
immersive reading mode with adjustable font size, curated daily verse/image,
a prayers hub with a step-by-step guided Rosary, **reader search** (the
magnifier in the Bible and Catechism headers jumps to the exact verse or
paragraph), a fully-scraped Catechism, and **Ask — AI chat** (streaming
thread, tool calls, details sheet, suggested questions, floating input,
per-message actions).

Planned, roughly by value:

- **MCP improvements** — populate the Neo4j graph with more relationships
  (saints ↔ verses, councils ↔ dogmas, etc.) so the `graph_related` tool and
  cross-reference queries become useful.
- **Public MCP server** — expose the existing Genkit tools (`search_scripture`,
  `get_verses`, `search_catechism`, `get_catechism`, `graph_related`) as a
  public MCP endpoint for external hosts (Claude, etc.).
- **Timeline (Explore)** — the app's namesake chronological view over the
  Neo4j concept graph. The backend `/timeline` endpoint and the
  `fetchTimeline` client already exist; the screen is still a placeholder.
- **Santoral detail** — the saints calendar lists days but rows aren't
  tappable; add a saint detail sheet like the celebrations one.
- **Scripture cross-references in the Catechism** — map CCC footnotes to
  verse entity IDs (`(:CatechismParagraph)-[:CITES]->(:Verse)`).
- **More guided prayers** — Stations of the Cross, Divine Mercy, Angelus.
- **Feast art** — extend curated images beyond the current fixed feasts.
- **Account** — password reset and profile editing.

## Security notes

- Passwords hashed with **bcrypt** (default cost).
- Stateless **HS256 JWTs**, 24 h expiry by default.
- `JWT_SECRET` **must** be set in production (`APP_ENV=production` enforces
  this); the baked-in dev secret is for local development only.
- Docker credentials above are for local development only.
