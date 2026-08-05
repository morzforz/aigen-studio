# Aigen Studio — Architecture (M0)

**Status:** Accepted for M1 scaffold (living; revise when stack choices change)  
**Related:** [CONCEPT.md](./CONCEPT.md) · [ROADMAP.md](./ROADMAP.md) · [RESEARCH.md](./RESEARCH.md) · [INDEX.md](../INDEX.md)

This note freezes **scaffold-ready** technical choices so M1 can start without inventing a stack. Product outcomes and hard rules live in CONCEPT; build order lives in ROADMAP. Vocabulary matches CONCEPT: **service-side** (NovelAI), **server-side** (ours), **client-side** (our web UI).

---

## 1. Hard rule (restated)

> **ALL NovelAI image generation must be human-initiated.** The server must never schedule, batch, or agent-loop NovelAI **image** jobs. Local/external LLMs may propose prompts or scaffolding text; they must not submit NovelAI image generation by themselves.

Preferred image path (CONCEPT §4.3): **client → our server → NovelAI image APIs**, only when the client sends an explicit Generate (or equivalent) action. Auto-save, metadata extract, and indexing run **after** a successful human-triggered job.

See CONCEPT §6 for full design consequences.

---

## 2. Topology

```text
[Browser / PWA on phone · tablet · desktop]
        │  LAN or Tailscale (private; not public internet)
        ▼
[Always-on Mac host — aigen-studio server]
   ├── HTTP API  (/api/v1/…)
   ├── SQLite DB + on-disk vault / uploads
   ├── Static + SPA web client (same origin in dev/prod default)
   └── (later) local LLM processes; NovelAI image proxy module
        │  only on explicit human Generate
        ▼
[NovelAI service-side image APIs]
```

- **One server process** (plus optional later worker/LLM children) owns durable state.
- Clients are **thin**: no durable vault or lore store in browser localStorage as system of record.
- Network exposure: **bind to Tailscale IP and/or localhost**; do not require opening the vault to the public internet.

---

## 3. Stack choices (concrete)

These are the v0 defaults. Changing them is allowed later but requires updating this doc and a short ROADMAP changelog note.

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Host** | Always-on **macOS** (primary: M3 Max MacBook Pro; later M4 Max Mini OK) | Matches CONCEPT §7.1; Apple Silicon RAM for later local LLMs |
| **Runtime** | **Node.js 22 LTS** (or current Active LTS) | One language with the web client; strong ecosystem; easy agent tooling |
| **Package manager / monorepo** | **pnpm** workspaces | Fast, disk-efficient; clear `apps/*` + `packages/*` split |
| **Server HTTP** | **Hono** on Node (`@hono/node-server`) | Small surface, typed middleware, easy REST; enough for API-first v0 |
| **ORM / SQL** | **Drizzle ORM** + **better-sqlite3** | Type-safe schema; **SQLite** fits single-user always-on Mac (one file, zero separate DB process) |
| **Validation / shared types** | **Zod** in `packages/shared` | Same request/response shapes for server and client |
| **Web client** | **Vite** + **React 19** + **TypeScript** | Primary client is web/PWA-class (CONCEPT); desktop-first UI in M1 is fine |
| **Client routing / data** | **React Router** + **TanStack Query** | Standard SPA routing; cache server state without inventing a store |
| **Styling (v0)** | **Plain CSS** (or CSS modules); no design-system dependency in M1 | Avoid blocking scaffold on UI kit choice |
| **Tests** | **Vitest** (unit/integration); server tests boot real Hono app with temp data dir | Matches ROADMAP M1 acceptance (automated health/CRUD) |
| **Language** | **TypeScript** strict for app code | Typed contracts across monorepo |

**Repo layout (target for M1):**

```text
aigen-studio/
  apps/
    server/          # Hono API, SQLite, file vault access
    web/             # Vite + React SPA
  packages/
    shared/          # Zod schemas, shared types, API path constants
  data/              # gitignored local dev default (or use AIGEN_DATA_DIR)
  docs/
  scripts/
```

**Dev loop:** one command (e.g. `pnpm dev`) runs API + Vite; production default serves built SPA from the server (same origin) so phones on Tailscale hit one port.

**Out of stack for M1:** Docker-required deploy, Postgres, Redis, Kubernetes, Electron/Tauri as primary client.

---

## 4. Storage layout (DB vs files)

### 4.1 Data root

Configurable **`AIGEN_DATA_DIR`** (absolute path). Defaults:

| Environment | Default |
|-------------|---------|
| Development | `<repo>/data` (gitignored) |
| Production / always-on | `~/Library/Application Support/aigen-studio` |

Never commit vault images, SQLite files, or secrets.

### 4.2 On-disk tree

```text
$AIGEN_DATA_DIR/
  aigen.sqlite              # structured rows (Drizzle)
  aigen.sqlite-wal          # SQLite WAL mode (enabled)
  secrets/
    app-token               # generated app bearer token (mode 0600)
    # novelai-api-key     # optional; or env AIGEN_NOVELAI_API_KEY (M4+)
  vault/
    images/
      <yyyy>/
        <mm>/
          <uuid>.png        # generated or imported images
  uploads/                  # user-uploaded refs, masks, vibes (later)
  exports/                  # scaffolding exports the user chose to keep on disk
  logs/                     # optional server logs
```

### 4.3 What lives where

| Data | Location | Notes |
|------|----------|--------|
| Characters, settings, lore text, tags/snippets metadata, feedback, generation settings snapshots, scaffolding job metadata | **SQLite rows** | Queryable; source of truth for structured product state |
| Image **bytes** (vault) | **Files under `vault/images/`** | DB row holds path, hash, dimensions, extracted metadata JSON, foreign keys |
| Uploaded ref/mask/vibe binaries | **Files under `uploads/`** | Same pattern: file + DB index row |
| Scaffolding compose outputs user **saves** | **SQLite** (text) and/or **`exports/`** file if user downloads permanently | M3 can start with API response + download only |
| App token, NovelAI API key | **`secrets/`** and/or env | Never in client bundle; never in git |
| Browser prefs (theme, last UI layout) | Client local only | Disposable; not the lore/vault system of record |

**SQLite mode:** WAL on; single writer (Node process). Sufficient for single-user multi-device read traffic over Tailscale.

**Backups (ops, not M1 code):** copy `$AIGEN_DATA_DIR` (stop or checkpoint SQLite first). Document in README when M1 lands.

---

## 5. Auth-lite (single-user, Tailscale-aware)

v0 is **single operator**, multi-device—not multi-tenant accounts.

| Concern | Decision |
|---------|----------|
| **Network trust** | Prefer **Tailscale** (or LAN) so the server is not public. Tailscale reachability alone is **not** full app auth. |
| **App auth** | One **app bearer token** required on all non-health API routes: `Authorization: Bearer <token>`. |
| **Token lifecycle** | Generated on first server start into `$AIGEN_DATA_DIR/secrets/app-token` if missing; printable once in server log / CLI `pnpm auth:show` (or equivalent). User pastes into web client (stored in sessionStorage or localStorage—client-only). |
| **Health** | `GET /api/v1/health` may be unauthenticated for uptime checks; must not leak vault/lore data. |
| **NovelAI key** | Server-side only (env or secrets file). Clients never need the NovelAI key for the preferred generate path. |
| **HTTPS** | On pure Tailscale/LAN, HTTP is acceptable for v0; TLS termination later if exposed beyond tailnet. |
| **Not in v0** | OAuth, multi-user roles, per-device certificates, public signup |

**Implication:** A stolen token is as powerful as local access to the machine’s app; treat token like a password. Rotate by replacing `app-token` and restarting.

---

## 6. API shape (v0)

| Choice | Detail |
|--------|--------|
| Style | **REST** + **JSON** request/response bodies |
| Prefix | **`/api/v1`** |
| Errors | JSON `{ "error": { "code": string, "message": string } }` with appropriate HTTP status |
| IDs | UUID strings in API; stored as text in SQLite |
| Pagination | Cursor or `limit`+`offset` query params when lists appear (M2+) |
| Auth header | `Authorization: Bearer <app-token>` |
| Content | `application/json` except multipart for image upload and raw image `GET` for vault bytes |

**Illustrative route groups** (not a full OpenAPI contract; names may refine in M1–M4):

| Group | Examples | Milestone |
|-------|----------|-----------|
| System | `GET /health`, `GET /ready` | M1 |
| Dummy / smoke | `GET/POST /api/v1/notes` (or similar) proving CRUD | M1 |
| Lore | `/api/v1/characters`, `/api/v1/settings` | M2 |
| Scaffolding | `POST /api/v1/scaffolding/compose` → memory / lorebook / system prompt drafts | M3 |
| Vault | `/api/v1/vault/images`, upload/import | M4 |
| NovelAI image proxy | `POST /api/v1/nai/image/generate` (**requires explicit client action; no batch/schedule**) | M4 |
| Feedback | `/api/v1/vault/images/:id/feedback` | M4/M5 |
| Libraries | tags, snippets, presets | M5 |
| Analysis | local/external LLM jobs (manual for paid) | M5 |

**WebSocket / SSE:** not required for M1. Optional later for long analysis jobs.

**CORS:** same-origin production; in pure Vite dev, allow the Vite origin with credentials/token header as needed.

---

## 7. Module boundaries

Server code organizes by **domain modules**. Each owns its routes, DB tables, and file paths; shared kernel is config, auth, db handle, and error helpers.

```text
apps/server/src/
  app.ts                 # Hono app assembly
  config.ts              # env + AIGEN_DATA_DIR
  db/                    # Drizzle schema + migrations
  middleware/auth.ts
  modules/
    system/              # health, ready
    lore/                # characters, settings, rich text profiles
    scaffolding/         # compose memory / lorebook / system prompts from lore
    vault/               # image index + filesystem vault I/O
    nai_image/           # NovelAI image API client + human-only generate handler
    libraries/           # tags, snippets, presets (later)
    feedback/            # ratings/notes on vault items (later)
    analysis/            # local / external LLM (later; never calls nai_image unattended)
  platform/
    files.ts             # safe paths under AIGEN_DATA_DIR
    secrets.ts
```

| Module | Responsibility | Must not |
|--------|----------------|----------|
| **lore** | CRUD for characters/settings and related textual lore | Call NovelAI; store large image blobs (refs only) |
| **scaffolding** | Compose exportable story setup from lore rows | Submit NovelAI image jobs; own NovelAI text-UI integration (L1) |
| **vault** | Persist image files + index metadata; serve bytes | Generate images by itself |
| **nai_image** | Forward **human-initiated** image generate/augment; on success hand off to vault | Expose timers/queues that generate without a request from a user action; accept “run N variants unattended” |
| **libraries** | Tags, snippets, presets | Own vault blobs |
| **feedback** | Structured reactions on vault (and later other entities) | Trigger generation |
| **analysis** | LLM over **our** corpus | Call `nai_image` generate without a separate human Generate in the client |

**Client modules** mirror routes lightly: `features/lore`, `features/scaffolding`, `features/vault`, `features/generate` (M4), plus shell layout.

**Shared package:** Zod schemas and `/api/v1/...` path constants only—no Node or browser-only APIs.

---

## 8. Config and secrets (M1 expectations)

| Variable / file | Purpose |
|-----------------|---------|
| `AIGEN_DATA_DIR` | Data root (see §4) |
| `AIGEN_HOST` | Bind address (default `127.0.0.1`; Tailscale IP or `0.0.0.0` only when intentionally LAN/tailnet-wide) |
| `AIGEN_PORT` | HTTP port (e.g. `8787`) |
| `AIGEN_APP_TOKEN` | Optional override instead of `secrets/app-token` |
| `AIGEN_NOVELAI_API_KEY` | Server-only; required for M4 generate, **not** for M1–M3 boot |
| `NODE_ENV` | `development` / `production` |

**M1 must start with no NovelAI key.** Missing key disables `nai_image` routes only.

---

## 9. Non-decisions (explicitly later)

Do **not** block M1–M3 on these; do not invent product commitments here:

| Topic | Status |
|-------|--------|
| **NovelAI text-UI path** (replace vs extend vs leave-in-place; scripting / extensions / userscripts) | Deferred — ROADMAP L1 / CONCEPT §5.9 |
| **Full tablet / Apple Pencil canvas** (mask/sketch density, pen quirks) | Deferred — concept goal remains; not architecture-critical until image canvas work |
| **LLM analysis depth** (models, prompts, job UX, what “pattern discovery” returns) | Deferred — M5; module boundary only |
| **Local imagegen / remote home GPU** | Deferred — ROADMAP L2 / CONCEPT §5.10 |
| Exact lore **schema** field list beyond “rich text + tags + optional image refs” | Decide in M2 design/impl |
| Metadata extract **implementation** (official Python stealth-PNG tooling vs pure TS) | Decide in M4; vault stores extracted JSON either way |
| Production process supervisor (launchd vs manual terminal) | Ops note in M1 README is enough |
| PWA install / offline | Optional later; online-to-server is enough for v0 |

---

## 10. Alignment with roadmap

| Milestone | Architecture implication |
|-----------|---------------------------|
| **M1** | pnpm monorepo, Hono, SQLite, Vite React, health + dummy CRUD, auth-lite token, data dir |
| **M2** | `lore` module + tables + UI |
| **M3** | `scaffolding` module; export/copy; no text-UI integration |
| **M4** | `vault` + `nai_image`; human-only generate; metadata extract choice |
| **M5** | `libraries`, `feedback`, `analysis` |

---

## 11. Changelog

| Date | Change |
|------|--------|
| 2026-08-04 | M0 initial architecture: Node/Hono/Drizzle/SQLite + Vite/React; data dir layout; auth-lite bearer + Tailscale; REST `/api/v1`; module boundaries; non-decisions listed. |
