# Aigen Studio — Roadmap

**Status:** Living document — update when requirements change or milestones complete  
**Related:** [CONCEPT.md](./CONCEPT.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [RESEARCH.md](./RESEARCH.md) · [INDEX.md](../INDEX.md)

This roadmap turns [CONCEPT.md](./CONCEPT.md) into an ordered build path. It is **not** a product concept and does not restate architecture vocabulary; outcomes and hard rules live in CONCEPT.

---

## How to use this document

| Status | Meaning |
|--------|---------|
| **Not started** | Not begun; still the planned next (or later) work. |
| **In progress** | Actively being implemented. |
| **Implemented** | Milestone acceptance criteria met in the codebase; residual polish may remain as follow-ups. |
| **Deferred** | Intentionally postponed (see notes); not counted as “current focus.” |
| **Cancelled** | No longer planned; leave a one-line reason. |

**Agents and humans must:**

1. Mark a milestone **Implemented** (and date it) when its acceptance criteria are met—not when a partial spike exists.
2. Adjust milestone order, split/merge milestones, or add new ones when **requirements or priorities change**; record a brief note under [Changelog](#changelog).
3. Keep [Current focus](#current-focus) accurate after meaningful progress.
4. Prefer small follow-up bullets under a milestone over inventing parallel secret trackers.

Stack and detailed design decisions belong in architecture/design docs once they exist; this file stays at **milestone** granularity.

---

## Current focus

| Field | Value |
|-------|--------|
| **Active milestone** | M4 — Image path (generate + vault + metadata) |
| **Default sequence** | Lore-first (M0 → M1 → M2 → M3 → M4 → later) |
| **Alternate path** | If lost images/settings dominate daily pain: after M1, do a thin vault/import slice before or in parallel with M2 (see [Sequencing notes](#sequencing-notes)) |

---

## Milestone overview

| ID | Milestone | Status | Depends on |
|----|-----------|--------|------------|
| M0 | Architecture sketch | Implemented | CONCEPT |
| M1 | Application scaffold | Implemented | M0 |
| M2 | Lore repository (characters / settings) | Implemented | M1 |
| M3 | Story scaffolding (export-first) | Implemented | M2 |
| M4 | Image path (generate + vault + metadata) | Not started | M1 (M2 recommended) |
| M5 | Libraries, feedback, and LLM assistance | Not started | M4 (M2/M3 for full dual-pillar value) |
| L1 | NovelAI text-UI integration path | Deferred | Open decision (CONCEPT §5.9) |
| L2 | Local imagegen / remote home GPU | Deferred | CONCEPT §5.10 |

---

## Milestones

### M0 — Architecture sketch

| | |
|--|--|
| **Status** | Implemented (2026-08-04) |
| **Goal** | Lock only the decisions needed to code without thrashing. |
| **Artifact** | [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) |

**Deliverables**

- Indexed architecture (or equivalent) design note covering:
  - Server + web client stack (always-on Mac host)
  - DB + file storage layout (vault files vs DB rows)
  - Auth-lite for single-user multi-device (Tailscale-aware)
  - API shape for v0 (e.g. REST/JSON)
  - High-level module boundaries (vault, lore, scaffolding, NovelAI image proxy)
- Explicit non-decisions: NovelAI text-UI path, full tablet/Pencil canvas, LLM analysis depth, local imagegen

**Acceptance**

- [x] Architecture doc exists and is listed in `INDEX.md`
- [x] Stack and storage choices are concrete enough to scaffold M1
- [x] Hard rule restated: human-initiated NovelAI **image** generation only

---

### M1 — Application scaffold

| | |
|--|--|
| **Status** | Implemented (2026-08-04) |
| **Goal** | Empty but real: run server on Mac, hit API from a browser (later Tailscale). |
| **Artifact** | pnpm monorepo (`apps/server`, `apps/web`, `packages/shared`) · [`README.md`](../README.md) |

**Deliverables**

- Always-on **server** process with config (data dir, ports, secrets location)
- Minimal **web client** (desktop-first is fine; responsive optional)
- Health check + one dummy CRUD path proving client ↔ server round-trip
- Automated tests that boot the server and exercise that path
- Documented run instructions (README or short ops note)

**Acceptance**

- [x] `dev` (or equivalent) starts server + client
- [x] Health (or CRUD) endpoint covered by an automated test
- [x] Config does not require NovelAI to start the app

---

### M2 — Lore repository (characters / settings)

| | |
|--|--|
| **Status** | Implemented (2026-08-04) |
| **Goal** | Durable server-side profiles for characters and settings—rich text first, image fields optional. |
| **Artifact** | `/api/v1/characters`, `/api/v1/settings` · SQLite tables · web Characters/Settings UI · `apps/server/src/lore.test.ts` |

**Deliverables**

- First-class **character** records (and **settings** / locations as first-class or clearly modeled siblings)
- Rich textual fields (bio, personality, voice/style, free-form notes, relationships as practical)
- Image-oriented fields that do **not** require generate yet (tags, UC/negatives, optional ref image paths)
- API + simple web UI: list, create/edit, search
- Data model that can feed both image compose (later) and story scaffolding (M3)

**Acceptance**

- [x] Characters (and settings) persist server-side across restarts
- [x] CRUD + basic search usable from the web client
- [x] Records can hold prose lore beyond image-only tags
- [x] No NovelAI API required for this milestone

**Why this order:** Shared spine for both pillars; no Anlas/ToS image path; immediate value for scattered lore.

---

### M3 — Story scaffolding (export-first)

| | |
|--|--|
| **Status** | Implemented (2026-08-04) |
| **Goal** | Easy path to assemble NovelAI-oriented story setup from saved lore—without a custom text UI. |
| **Artifact** | `POST /api/v1/scaffolding/compose` · pure `composeFromLore` · web Scaffold tab (copy/download) · `apps/server/src/scaffolding.test.ts` |

**Deliverables**

- Compose flows from selected profiles/lore, e.g.:
  - Memory text
  - Lorebook-style entries
  - System prompts / instruction blocks
- **Copy to clipboard** and/or **download** (text/JSON) as the v1 delivery path
- Optional: save composed scaffolding artifacts back into our store

**Acceptance**

- [x] User can select lore entities and produce memory / lorebook / system-prompt drafts
- [x] Output is copy/exportable without NovelAI text-UI integration
- [x] Scaffolding does not submit NovelAI **image** jobs

**Out of scope for M3:** Replacing or wrapping NovelAI’s text editor; extensions/userscripts/scripting (see L1).

---

### M4 — Image path (generate + vault + metadata)

| | |
|--|--|
| **Status** | Not started |
| **Goal** | Human-initiated NovelAI image generation with durable auto-save and recoverable settings. |

**Deliverables** (prefer in this internal order)

1. Generate proxy: client → our server → NovelAI image API (explicit human Generate only)
2. Auto-save into server-side vault + basic gallery
3. Metadata extract (stealth PNG alpha + ordinary PNG text chunks as practical)
4. Wire character tags/refs from lore store into compose UI (when M2 done)
5. Feedback on vault images (like / rate / note)—may start here or extend in M5

**Acceptance**

- [ ] Human-only generate path works; no unattended NovelAI image jobs
- [ ] Successful generations land in our vault with recoverable metadata when NovelAI embeds it
- [ ] Gallery can browse vault items
- [ ] Hard limitation (CONCEPT §6) is enforced in design and API surface

**Depends on:** M1 required; M2 strongly recommended before “compose from character.”

---

### M5 — Libraries, feedback, and LLM assistance

| | |
|--|--|
| **Status** | Not started |
| **Goal** | Compounding prompt knowledge and analysis over our corpus—not NovelAI automation. |

**Deliverables** (may ship as sub-milestones)

- Broader library store: tags, snippets, imagegen presets, vibes/refs as prioritized
- Feedback knowledge base usable for filter + later mining (if not fully done in M4)
- Local-to-server LLM for pattern discovery and optional scaffolding/text assist
- External/paid LLM API path **manual-only** (cost control)

**Acceptance**

- [ ] At least one non-character library type (e.g. tags or presets) is durable and pickable in UI
- [ ] Feedback on images can be stored and listed/filtered
- [ ] Local and/or external LLM paths operate on **our** data only and never auto-submit NovelAI image jobs
- [ ] External LLM requires explicit user initiation

---

## Later / deferred

### L1 — NovelAI text-UI integration path

| | |
|--|--|
| **Status** | Deferred |
| **Goal** | Decide how generated/scaffolded text lands in NovelAI day-to-day. |

Options remain open (CONCEPT §5.9): leave NovelAI text UI alone; scripting; browser extension/userscript; deeper API integration; full custom text UI (least preferred early).

**Do not start** until M2/M3 prove the repository + export path and a concrete integration preference is chosen.

### L2 — Local imagegen / remote home GPU

| | |
|--|--|
| **Status** | Deferred |
| **Goal** | Non-NovelAI image generation on our hardware or another owned machine (CONCEPT §5.10). |

Architecture should not forbid this; it is not near-term delivery.

---

## Explicitly not near-term

- Full NovelAI image UI feature-clone
- Perfect multi-surface (phone/tablet/Pencil) polish before a solid desktop (or simple responsive) client
- Multi-user / multi-tenant productization
- Public hosting of vault or NovelAI credentials

---

## Sequencing notes

```text
Default (lore-first):
  M0 → M1 → M2 → M3 → M4 → M5
                 ↘─────→ M4 can start after M1 if image pain dominates;
                          still wire lore into compose after M2

Deferred:
  L1, L2 (and deep text-gen research) after M3 proves export value
```

**Lore-first (default):** Best match for the dual-pillar scope change—durable characters/settings and story scaffolding without waiting on NovelAI image plumbing.

**Vault-early alternate:** After M1, add thin import/upload + metadata extract (subset of M4) if session-loss of images is the daily emergency; then continue M2/M3 so lore does not stall forever.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-04 | **M3 Implemented:** story scaffolding compose from selected lore → memory / lorebook / system-prompt drafts; `POST /api/v1/scaffolding/compose`; web Scaffold tab with copy + download export; no NovelAI image jobs. Current focus → M4. |
| 2026-08-04 | **M2 Implemented:** characters + settings lore tables and authenticated CRUD/search under `/api/v1`; rich prose + optional image fields; web list/edit/search UI; Vitest on real handlers with restart persistence. Current focus → M3. |
| 2026-08-04 | **M1 Implemented:** pnpm monorepo scaffold (Hono/SQLite server, Vite/React web, shared Zod); health + notes CRUD under `/api/v1`; auth-lite bearer; Vitest on real `createApp`; README run instructions. Current focus → M2. |
| 2026-08-04 | **M0 Implemented:** architecture note at `docs/ARCHITECTURE.md` (Node/Hono/SQLite + Vite/React, storage, auth-lite, REST `/api/v1`, modules). Current focus → M1. |
| 2026-08-04 | Initial roadmap from concept-level milestone discussion (lore-first sequence). |
