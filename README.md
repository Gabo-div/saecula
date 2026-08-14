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
│   └── mobile/     # React Native app (Expo + TypeScript, Tamagui v2, Zustand, Axios)
├── libs/
│   └── canon/      # Shared Go module: canonical catalog of the 73 books
├── docker-compose.yml
├── go.work         # Go workspace tying back + cli + canon together
└── README.md
```

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
`JWT_SECRET`, `JWT_EXPIRATION`); defaults match docker-compose.

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

Profile/settings (theme, accent, language, translation) is reached from a
button in the Home header, not a tab. **Prayers** are opened the same way
(Home header / quick action): a hub of individual prayers — each on its own
page with an EN/ES/LA selector — and a full-screen, step-by-step guided
Rosary that walks the day's mysteries bead by bead.

```bash
cd apps/mobile
npm install
npm start
```

The backend URL comes from `.env` (`EXPO_PUBLIC_API_URL`, default
`http://localhost:8080` — copy `.env.example` to `.env` and adjust).
`localhost` works for web and the iOS simulator; the Android emulator
needs `http://10.0.2.2:8080`; a physical device (Expo Go) needs your
machine's LAN IP, e.g. `http://192.168.1.9:8080`. Expo inlines the
variable at bundle time, so **restart `expo start` after editing `.env`**.
Every request is logged to the Metro/browser console in dev
(`[api] → …` / `[api] ← …`).

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
and a prayers hub with a step-by-step guided Rosary.

Planned, roughly by value:

- **Timeline (Explore)** — the app's namesake chronological view over the
  Neo4j concept graph. The backend `/timeline` endpoint and the
  `fetchTimeline` client already exist; the screen is still a placeholder.
- **Reader search** — the magnifier in the Bible and Catechism headers is
  inert; wire it to search text and jump to a verse/paragraph.
- **Santoral detail** — the saints calendar lists days but rows aren't
  tappable; add a saint detail sheet like the celebrations one.
- **Polish the Catechism scrape** — coverage is ~99.9% (EN misses 2077 &
  2436; a few source-formatting anomalies remain). Recover the stragglers.
- **Scripture cross-references in the Catechism** — map CCC footnotes to
  verse entity IDs (`(:CatechismParagraph)-[:CITES]->(:Verse)`).
- **More guided prayers** — Stations of the Cross, Divine Mercy, Angelus.
- **"Ask"** — the reserved Home quick action (Q&A), not yet built.
- **Feast art** — extend curated images beyond the current fixed feasts.
- **Account** — password reset and profile editing.

## Security notes

- Passwords hashed with **bcrypt** (default cost).
- Stateless **HS256 JWTs**, 24 h expiry by default.
- `JWT_SECRET` **must** be set in production (`APP_ENV=production` enforces
  this); the baked-in dev secret is for local development only.
- Docker credentials above are for local development only.
