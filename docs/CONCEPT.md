# ImageGen Studio — Concept Document

**Status:** Concept (product outcomes, not implementation design)  
**Scope:** Full-stack web application focused on **NovelAI image generation**  
**Related:** [RESEARCH.md](./RESEARCH.md) · [INDEX.md](../INDEX.md)

---

## 1. Problem

NovelAI’s official image UI is powerful for generation, but durable personal workflow is weak:

- **Service-side image storage is transient.** Generations live only for the browser session; refresh or leave the page and history is gone unless the user manually downloads.
- **Browser-local storage is fragile.** Local history, vibes, and prefs can be wiped by cache clears, profile resets, or device switches.
- **Prompt knowledge does not compound.** Tags, snippets, character recipes, vibe refs, and “what worked last time” live in memory, scattered files, or ad-hoc notes—not in a queryable store tied to the UI.
- **Feedback is not captured as data.** Likes, ratings, and qualitative notes on generations are rarely structured, so patterns that produce good results are hard to rediscover or learn from.

This project builds a **full-stack frontend** that wraps and extends NovelAI’s image generation experience: the user still generates through NovelAI, but **our** application persists images, metadata, library content, and feedback **server-side**, and optionally analyzes that corpus with local (and, when requested, external) LLMs.

---

## 2. Domain vocabulary

These terms are used consistently across product and engineering docs.

| Term | Meaning |
|------|---------|
| **Service-side** | Anything on **NovelAI’s** servers, including their APIs, models, Anlas accounting, and any storage they provide. NovelAI does **not** permanently store user image generations (session-only history). |
| **Server-side** | **Our** application server and storage: databases, file stores, local AI models, analysis jobs, and durable image vaults running on infrastructure we control (initially a developer Mac). |
| **Client-side** | The browser (or equivalent) UI for **our** application—the layer that presents generation controls, library pickers, feedback, and results. It wraps around / builds on / enhances NovelAI’s image generation interface and talks to both NovelAI (service-side) and our backend (server-side). |

**Implication:** “Save to the server” always means **our** server-side store, never “rely on NovelAI to keep the image.”

---

## 3. Product summary

ImageGen Studio is a **full-stack web application** for NovelAI **image** generation (not text-first storytelling). A large share of application state lives **server-side**: generated images, tag/snippet libraries, character and vibe references, generation settings snapshots, and user feedback.

The **primary client** is a **web** UI (browser and/or installable PWA-class experience)—chosen for painless access on phones, tablets, and desktops without a Flutter-first or native-first product spine. The client is where the human composes prompts and **initiates** every NovelAI generation. After a human-triggered generation succeeds, the app persists the result and metadata to our server and surfaces library content back into the next prompt session.

Clients and server are **decoupled**: the server may run continuously on one machine while clients run on others (see §4 and §7).

---

## 4. Architecture layers and deployment

### 4.1 Logical layers

```text
┌─────────────────────────────────────────────────────────────┐
│ Client-side (our web UI — phone / tablet / desktop)         │
│  Prompt/compose · gallery · library pickers · feedback UI   │
│  Human “Generate” action only for NovelAI jobs              │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────┐
│ Service-side (NovelAI)    │   │ Server-side (ours)          │
│ Image gen / img2img /     │   │ Image vault · DB/file store │
│ inpaint · director tools  │   │ Tags, characters, vibes     │
│ vibe / precise reference  │   │ Feedback · settings extract │
│ Transient history only    │   │ Local LLM analysis          │
│                           │   │ Optional external LLM API   │
└───────────────────────────┘   └─────────────────────────────┘
```

- **Client ↔ Server:** CRUD for libraries, gallery/vault, feedback, metadata import/export, analysis requests; preferred path for initiating NovelAI jobs so auto-save can complete in one pipeline (see §4.3).
- **Server ↔ Service (preferred):** Human-initiated image generation and related NovelAI image APIs, forwarded only because a client issued an explicit Generate (or equivalent) action.
- **Server (local LLM):** Pattern-finding over stored feedback, prompts, and settings (no NovelAI generation).
- **Server (external LLM API, e.g. Grok):** Higher-quality analysis **only when the user manually starts it** (cost control).

Detailed tech stack, schemas, and APIs are out of scope for this concept document.

### 4.2 Decoupled client/server deployment

Durable product state lives on the **server**, not on any single browser:

| Concern | Location |
|---------|----------|
| Image vault, libraries (tags, snippets, characters, vibes, presets), feedback, settings snapshots | **Always-on server-side** |
| Local LLM analysis (and later local imagegen) | **Server-side** (Mac host RAM/CPU) |
| Compose UI, surface-specific layout, feedback entry, human Generate control | **Client-side** (any supported device) |

**Topology (conceptual):**

```text
[Phone / tablet / desktop browser or PWA]
        │
        │  LAN and/or Tailscale (tailnet)
        ▼
[Always-on Mac server — vault, DB, local LLM, NovelAI proxy]
        │
        │  only on explicit human Generate (or equivalent)
        ▼
[NovelAI service-side image APIs]
```

- The server is expected to run **continuously** (or whenever the product is used); that ops tradeoff is accepted so multi-device access and background-friendly vault/analysis remain simple.
- Clients may run on **other machines** than the server. Remote access over an existing **Tailscale** (or equivalent private VPN/tailnet) setup is an **accepted** path; the product does not depend on exposing the vault or NovelAI credentials to the public internet.
- The server is **API-first** in spirit: the web UI is the first client; a future native shell could call the same APIs without relocating durable state.

### 4.3 NovelAI generate path (concept leaning)

Prefer **client → our server → NovelAI** for image generation so that:

- The NovelAI API key can live primarily **server-side** (not on every phone).
- On success, **auto-save**, metadata extraction, and indexing can happen in one server pipeline.
- Thin clients (especially mobile) stay simpler.

Regardless of transport, **§6 still applies**: the server must never schedule or batch NovelAI image jobs on its own—only forward requests caused by an explicit human action in a client.

Browser-direct NovelAI calls remain a possible alternative later, but they make reliable auto-save and multi-device key handling harder and are not the preferred default.

---

## 5. Main goals

Not an exhaustive product roadmap; goals may grow as we learn. Current intended outcomes:

### 5.1 Durable auto-save of generations

Automatically save generated images to **our server** when generation completes. NovelAI’s service-side storage is session-transient; browser storage is always subject to deletion. Server-side vault is the system of record for “images we care about keeping.”

### 5.2 Broad library store (DB + files)

Maintain a durable store of assets that make prompting faster and more consistent, including:

- Textual **tags** and multi-tag **snippets**
- **Imagegen settings** presets (steps, guidance, sampler, resolution, model, etc.)
- **Character profiles** (see below)
- **Vibe references** and related aesthetic refs
- Other images used as **base images**, **inpainting** sources/masks, or director/precise references

Contents of this store are exposed in the **client-side** interface for convenient reuse.

### 5.3 Character profiles

First-class records for characters the user generates often:

- Image references (character / style / combined, as NovelAI supports)
- Textual descriptions / profiles
- Common tags and negative/UC patterns
- Optional links to outfits, snippets, or generation presets

### 5.4 Feedback as a knowledge base

Record user feedback on generated images—likes, ratings, free-text review notes, and similar signals. Purpose: build a structured record of what generations **worked** (and what did not), for later retrieval and analysis.

### 5.5 Extract generation settings from image metadata

Support reading imagegen parameters from generated image files. NovelAI embeds generation metadata in PNG form (including **stealth PNG alpha-channel** storage and ordinary PNG text chunks). Clipboard copy and some save paths may omit metadata; the product should prefer paths that preserve it and implement robust extraction (see RESEARCH.md).

### 5.6 Local-to-server LLM for pattern discovery

Use a **local-to-server-layer** LLM (running on our machine, not NovelAI) to process feedback, library contents, and imagegen settings. Goal: surface patterns that inform better future generations and discover usage habits that correlate with pleasing results. This path is intended for routine/automated analysis **of our stored data only**—it must never trigger NovelAI image generation.

### 5.7 External / paid LLM API (manual only)

Support calling a higher-quality remote LLM API (e.g. Grok) for deeper analysis. **Always manually initiated by the user** because of cost.

### 5.8 Longer-term (deferred, not current priority)

- Local-to-server-layer **image generation** (non-NovelAI models on our hardware)
- API access to local LLM / imagegen models served on another machine the user owns

These remain conceptual placeholders so architecture does not paint us into a corner; they are **not** near-term deliverables.

---

## 6. Hard limitation — human-initiated NovelAI generation only

> **HARD LIMITATION:** **ALL** image generation done on NovelAI’s services must be **human-initiated at all times**. Automated generation is strictly prohibited by their Terms of Service, and we will not design or implement features that risk an account ban.

**Design consequences (non-negotiable):**

- No batch queues, schedulers, agents, or scripts that call NovelAI image generation without an explicit human generate action.
- No “auto-improve by regenerating N variants” loops that hit NovelAI without a click per generation.
- Local LLM analysis, library suggestions, and feedback mining may **propose** prompts/settings; they must not **submit** NovelAI jobs by themselves.
- Server-side automation is limited to post-generation work we own: save, index, extract metadata, analyze stored data.
- An always-on server and multi-device clients do **not** relax this rule: “server is up” never means “server generates on its own.”

Official terms (e.g. restrictions on automated systems that place excessive strain on the service) reinforce treating NovelAI generation as interactive and human-driven: https://novelai.net/terms/

---

## 7. Platform, clients, and surfaces

### 7.1 Server host hardware

| Item | Detail |
|------|--------|
| Primary dev / server host | MacBook Pro **M3 Max**, 14 cores, **36 GB** RAM |
| Possible later host | Mac Mini **M4 Max**, **48 GB** RAM |
| Runtime expectation | Server process **always-on** (or on whenever the product is used) |
| Remote access | **Tailscale** (or equivalent private tailnet/VPN) is an accepted way for clients on other devices to reach the server |
| Implications | Server-side local LLMs and (later) local imagegen must fit Apple Silicon memory budgets; prefer models and batch sizes that leave headroom for the web stack and image vault I/O |

### 7.2 Primary client: web (browser / PWA-class)

- The **primary client** is a **web** interface—not a Flutter-first or native-iOS-first spine.
- Goal: painless multi-device access, especially **mobile**, via ordinary browser or installable PWA-class “Add to Home Screen” where useful.
- One web client codebase, adapted by **surface** (below)—not a separate product per device class.
- Optional future native shells may appear later; they must talk to the same server APIs and must not become the only home of durable state.

### 7.3 Three client surfaces

Feature availability follows **surface and capability** (viewport, pointer type, user needs)—not “desktop UI shrunk to phone” or “phone UI stretched to iPad.”

| Surface | Role | Typical fit | Not primary on this surface |
|---------|------|-------------|-----------------------------|
| **Phone** | Vault-first + light create | Browse/search gallery; view metadata; feedback (like/rate/note); pick character/snippet/preset; **simplified generate** (prompt, UC, seed, limited settings) | Dense multi-panel editors; multi-layer canvas; heavy precise inpaint/mask painting; ultra-dense vibe/ref shelves |
| **Tablet** (iPad-focused) | **Robust creative client** | Full-ish generate session: prompts, multi-character as practical, vibes/refs, gallery, library use, **mask/sketch/inpaint-oriented canvas**, feedback | Pure phone-stack layout; treating tablet as “large phone only” |
| **Desktop** | Full power-user density | Everything: widescreen multi-panel layout, bulk library work, comparison, analysis dashboards, maximum settings density | N/A (superset) |

**Phone** is intentionally reduced: review generations, leave feedback, and light re-rolls—not a full inpainting workstation.

**Tablet** is a first-class creative surface (especially iPad), not a zoomed phone layout. Split panes, collapsible rails, and a large canvas region are appropriate.

**Desktop** remains the maximum-density environment for power workflows.

Optional user overrides (“simple mode” / “show denser layout”) are desirable later so an iPad user can choose phone-simple or desktop-dense when needed.

### 7.4 Apple Pencil on iPad (explicit goal)

**Apple Pencil** support for **mask painting, sketch-before-img2img, and similar canvas work** on iPad is an **explicit product goal** for the **web client** (concept-level intent—not an implementation guide in this document).

Implications at concept level:

- Tablet/desktop canvas work is **pointer-first** (including pen pressure where the platform exposes it), not mouse-only UI with touch bolted on.
- Mask/sketch canvas is gated by **surface/capability** (tablet and desktop—and pen-capable pointers), **not** by “desktop only,” so iPad is not excluded.
- Web/PWA is expected to be sufficient for a solid Pencil mask/sketch experience; a native PencilKit app is **not** required for this goal.
- Implementation will need to avoid common pen pitfalls (e.g. pen drags misread as **text selection** / UI highlighting)—handled at implementation time via selection and gesture ownership on non-text chrome and the canvas, without changing this concept’s scope.

Phone remains free of requiring dense Pencil-driven inpaint UIs.

---

## 8. Out of scope for this concept (near term)

- Choosing a production tech stack (frameworks, ORM, vector DB, etc.)
- Implementing canvas/Pencil event handling, PWA install flows, or auth schemes in detail
- Cloning third-party clients feature-for-feature (including Flutter ports)
- Multi-user productization, billing, or public multi-tenant hosting
- Exhaustive reverse-engineering of undocumented NovelAI APIs beyond public docs and documented third-party practice
- Automated NovelAI generation of any kind (see §6)
- Native iOS/Swift or Flutter as the primary client

---

## 9. Success signals (concept level)

We are succeeding when:

1. After a human generates an image, it (and recoverable settings) reliably land in **our** vault without depending on NovelAI session history.
2. Tags, snippets, characters, vibes, and presets are reusable from the UI without hunting through folders.
3. Feedback accumulates and can be queried or summarized.
4. Settings can be rehydrated from saved PNG metadata when NovelAI embeds them.
5. Local LLM analysis can run over our corpus without ever firing NovelAI generation; external LLM analysis is opt-in and explicit.
6. Nothing in the product design depends on unattended NovelAI image jobs.
7. A client on another device (e.g. phone or iPad over Tailscale) can use the vault and human-initiated generate against the always-on server.
8. Phone, tablet, and desktop each feel intentional—not a single layout poorly scaled—and iPad canvas work is designed with Apple Pencil in mind.

---

## 10. Open questions

Tracked for later design work (not blockers for this concept):

- How tightly we integrate with NovelAI’s official web UI vs. a clean-room client that uses the same image APIs.
- Exact metadata extraction stack (official stealth-PNG tools vs. third-party PNG text-chunk round-trip).
- Auth model for single-user multi-device access (e.g. app password vs device tokens vs Tailscale-trust plus local auth)—tailnet reachability alone is not a full app-auth design.
- What “like / rating / review” schema best supports both UI filters and LLM pattern mining.
- How complete the **v1 tablet** surface is (generate + gallery + feedback + Pencil mask first vs also multi-character + full vibe shelves on day one).
- Thumbnail / progressive load strategy for large vaults over Tailscale away from home LAN.

See [RESEARCH.md](./RESEARCH.md) for prior art and NovelAI platform facts that inform these decisions.
