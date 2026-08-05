# Aigen Studio

Full-stack app for NovelAI **image** workflows plus a durable **lore repository** and **story scaffolding** (memory / lorebook / system prompts). Product concept: [`docs/CONCEPT.md`](docs/CONCEPT.md). Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Roadmap: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Requirements

- **Node.js** 20+ (22+ recommended)
- **pnpm** 9+ (`npm install -g pnpm`)

## Install

```bash
pnpm install
```

## Development

Starts the API server (default `http://127.0.0.1:8787`) and Vite web client (`http://127.0.0.1:5173`) together. The Vite dev server proxies `/api` to the API.

```bash
pnpm dev
```

Open **http://127.0.0.1:5173**. On first server start a bearer **app token** is generated under the data directory and printed in the server log.

### App token

```bash
pnpm auth:show
```

Paste the token into the web UI “App token” field (stored in `localStorage`). All API routes except health require:

```http
Authorization: Bearer <token>
```

### Data directory

| Env | Default (development) |
|-----|------------------------|
| `AIGEN_DATA_DIR` | `<repo>/data` (gitignored) |
| `AIGEN_HOST` | `127.0.0.1` |
| `AIGEN_PORT` | `8787` |
| `AIGEN_APP_TOKEN` | optional override of `secrets/app-token` |
| `AIGEN_WEB_ORIGIN` | `http://127.0.0.1:5173` (CORS for Vite) |
| `AIGEN_NOVELAI_API_KEY` | **not required** until M4 |

Layout under the data dir (see architecture): `aigen.sqlite`, `secrets/app-token`, `vault/images/`, `uploads/`, `exports/`.

### Tests

```bash
pnpm test
```

Boots the real Hono app factory with a temp data dir and exercises health + notes CRUD.

### Production-ish listen only

```bash
pnpm --filter @aigen-studio/server start   # after build
# or during development without Vite:
pnpm --filter @aigen-studio/server dev
```

For Tailscale access, bind with `AIGEN_HOST` set to your tailnet IP (or `0.0.0.0` on a trusted network only). Prefer keeping the server off the public internet.

## Monorepo layout

```text
apps/server   # Hono + Drizzle/SQLite API
apps/web      # Vite + React client
packages/shared  # Zod schemas + /api/v1 path constants
docs/         # CONCEPT, ARCHITECTURE, ROADMAP, RESEARCH
```

## Current milestone

See [`docs/ROADMAP.md`](docs/ROADMAP.md). M1 is the application scaffold (this README). Next: **M2 lore repository**.
