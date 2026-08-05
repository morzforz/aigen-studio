# Aigen Studio — Concept Document

**Status:** Concept (product outcomes, not implementation design)  
**Scope:** Full-stack web application for NovelAI **image** generation workflows **and** assistance with **text** generation (NovelAI text, optional local LLMs), plus a durable lore / profile repository for story scaffolding  
**Related:** [RESEARCH.md](./RESEARCH.md) · [INDEX.md](../INDEX.md)

**Product names:** **Aigen Studio** (display) · **aigen-studio** (repo / package identity). Formerly framed as “ImageGen Studio” while the product was image-only; that name is retired.

---

## 1. Problem

NovelAI’s official image UI is powerful for generation, but durable personal workflow is weak:

- **Service-side image storage is transient.** Generations live only for the browser session; refresh or leave the page and history is gone unless the user manually downloads.
- **Browser-local storage is fragile.** Local history, vibes, and prefs can be wiped by cache clears, profile resets, or device switches.
- **Prompt knowledge does not compound.** Tags, snippets, character recipes, vibe refs, and “what worked last time” live in memory, scattered files, or ad-hoc notes—not in a queryable store tied to the UI.
- **Feedback is not captured as data.** Likes, ratings, and qualitative notes on generations are rarely structured, so patterns that produce good results are hard to rediscover or learn from.

Separately, starting a new **story** (NovelAI text generation and related tooling) is friction-heavy when lore lives outside a reusable store:

- **Character and setting knowledge is scattered.** Appearance tags for imagegen, prose bios, relationships, locations, and tone notes often live in separate notes or ad-hoc lorebook drafts—not one durable repository.
- **Story scaffolding is repeated work.** Composing memory text, lorebook entries, system prompts, and similar NovelAI-oriented artifacts for a new story often means re-copying the same character/setting material by hand.

This project builds a **full-stack application** that:

1. Wraps and extends NovelAI’s **image** generation experience: the user still generates through NovelAI, but **our** application persists images, metadata, library content, and feedback **server-side**, and optionally analyzes that corpus with local (and, when requested, external) LLMs.
2. Acts as a **repository for richer textual lore** (characters, settings, and related story assets) and an **easy path to scaffold a new NovelAI story**—composing memory text, lorebook entries, system prompts, and similar artifacts from saved profiles/lore in our DB.
3. Assists with **text generation** in NovelAI (and optionally via **local LLMs**), without committing yet to replacing or reimplementing NovelAI’s text-generation UI (see §5.9 and §8).

---

## 2. Domain vocabulary

These terms are used consistently across product and engineering docs.

| Term | Meaning |
|------|---------|
| **Service-side** | Anything on **NovelAI’s** servers, including their APIs, models, Anlas accounting, and any storage they provide. NovelAI does **not** permanently store user image generations (session-only history). |
| **Server-side** | **Our** application server and storage: databases, file stores, local AI models, analysis jobs, durable image vaults, and lore / profile repositories running on infrastructure we control (initially a developer Mac). |
| **Client-side** | The browser (or equivalent) UI for **our** application—the layer that presents generation controls, library pickers, lore/profile editors, feedback, story-scaffolding helpers, and results. It wraps around / builds on / enhances NovelAI’s image generation interface (and may later assist NovelAI text workflows) and talks to both NovelAI (service-side) and our backend (server-side). |
| **Lore repository** | Server-side durable store of **textual** (and linked image) information about characters, settings, and related story assets—beyond image-only tags/refs—used both for image prompting and for story scaffolding. |
| **Story scaffolding** | Composing NovelAI-oriented text artifacts (e.g. **memory** text, **lorebook** entries, **system prompts**, and similar) from saved lore/profiles so starting a new story is less manual re-assembly. |

**Implication:** “Save to the server” always means **our** server-side store, never “rely on NovelAI to keep the image” (or lore).

---

## 3. Product summary

**Aigen Studio** is a **full-stack web application** with two first-class pillars:

1. **Image workflows** — NovelAI **image** generation with durable vault, libraries, feedback, metadata extract, and LLM analysis of that corpus (the original ImageGen Studio outcomes).
2. **Text & lore workflows** — Assistance with **text** generation (NovelAI text generation, with optional **local LLMs** if desired), a durable **lore repository** for characters/settings/etc., and **story scaffolding** that turns saved profiles into NovelAI-ready memory / lorebook / system-prompt material.

A large share of application state lives **server-side**: generated images, tag/snippet libraries, character and vibe references, **rich textual character and setting lore**, generation settings snapshots, user feedback, and scaffolding outputs the user chooses to keep.

The **primary client** is a **web** UI (browser and/or installable PWA-class experience)—chosen for painless access on phones, tablets, and desktops without a Flutter-first or native-first product spine. For image work, the client is where the human composes prompts and **initiates** every NovelAI image generation. After a human-triggered image generation succeeds, the app persists the result and metadata to our server and surfaces library content back into the next prompt session.

**NovelAI’s official text-generation UI is strong**; we do **not** decide in this concept whether to replace it, wrap it, or leave generation there and assist via scripting / browser extensions / userscripts. That path is **open / deferred** (see §5.9 and §8). What we *do* commit to now is the **repository + scaffolding** value and treating text assistance (including local LLMs) as in-scope product direction.

Clients and server are **decoupled**: the server may run continuously on one machine while clients run on others (see §4 and §7).

---

## 4. Architecture layers and deployment

### 4.1 Logical layers

```text
┌─────────────────────────────────────────────────────────────┐
│ Client-side (our web UI — phone / tablet / desktop)         │
│  Prompt/compose · gallery · library pickers · feedback UI   │
│  Lore / profile editors · story scaffolding helpers         │
│  Human “Generate” action only for NovelAI *image* jobs      │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────┐
│ Service-side (NovelAI)    │   │ Server-side (ours)          │
│ Image gen / img2img /     │   │ Image vault · DB/file store │
│ inpaint · director tools  │   │ Tags, characters, vibes     │
│ vibe / precise reference  │   │ Lore repository (chars,     │
│ Transient history only    │   │   settings, story assets)   │
│ Text gen (optional path;  │   │ Feedback · settings extract │
│   UI integration deferred)│   │ Story scaffolding outputs   │
│                           │   │ Local LLM analysis / assist │
│                           │   │ Optional external LLM API   │
└───────────────────────────┘   └─────────────────────────────┘
```

- **Client ↔ Server:** CRUD for libraries, gallery/vault, lore/profiles, feedback, metadata import/export, scaffolding requests, analysis requests; preferred path for initiating NovelAI **image** jobs so auto-save can complete in one pipeline (see §4.3).
- **Server ↔ Service (preferred for image):** Human-initiated image generation and related NovelAI image APIs, forwarded only because a client issued an explicit Generate (or equivalent) action.
- **Server (local LLM):** Pattern-finding over stored feedback, prompts, and settings; optional assistance for text / scaffolding (no unattended NovelAI **image** generation).
- **Server (external LLM API, e.g. Grok):** Higher-quality analysis **only when the user manually starts it** (cost control).

Detailed tech stack, schemas, and APIs are out of scope for this concept document.

### 4.2 Decoupled client/server deployment

Durable product state lives on the **server**, not on any single browser:

| Concern | Location |
|---------|----------|
| Image vault, libraries (tags, snippets, characters, vibes, presets), lore repository (rich character/setting text), feedback, settings snapshots, scaffolding artifacts the user keeps | **Always-on server-side** |
| Local LLM analysis / text assistance (and later local imagegen) | **Server-side** (Mac host RAM/CPU) |
| Compose UI, surface-specific layout, feedback entry, lore editors, scaffolding UI, human Generate control (images) | **Client-side** (any supported device) |

**Topology (conceptual):**

```text
[Phone / tablet / desktop browser or PWA]
        │
        │  LAN and/or Tailscale (tailnet)
        ▼
[Always-on Mac server — vault, DB, lore, local LLM, NovelAI image proxy]
        │
        │  only on explicit human Generate (or equivalent) for *images*
        ▼
[NovelAI service-side image APIs]
```

- The server is expected to run **continuously** (or whenever the product is used); that ops tradeoff is accepted so multi-device access and background-friendly vault/analysis remain simple.
- Clients may run on **other machines** than the server. Remote access over an existing **Tailscale** (or equivalent private VPN/tailnet) setup is an **accepted** path; the product does not depend on exposing the vault or NovelAI credentials to the public internet.
- The server is **API-first** in spirit: the web UI is the first client; a future native shell could call the same APIs without relocating durable state.

### 4.3 NovelAI image generate path (concept leaning)

Prefer **client → our server → NovelAI** for **image** generation so that:

- The NovelAI API key can live primarily **server-side** (not on every phone).
- On success, **auto-save**, metadata extraction, and indexing can happen in one server pipeline.
- Thin clients (especially mobile) stay simpler.

Regardless of transport, **§6 still applies**: the server must never schedule or batch NovelAI **image** jobs on its own—only forward requests caused by an explicit human action in a client.

Browser-direct NovelAI image calls remain a possible alternative later, but they make reliable auto-save and multi-device key handling harder and are not the preferred default.

**Text generation path** (NovelAI text APIs, local LLMs, scripting, extensions) is **not** locked here—see §5.9.

---

## 5. Main goals

Not an exhaustive product roadmap; goals may grow as we learn. Current intended outcomes:

### 5.1 Durable auto-save of generations

Automatically save generated images to **our server** when generation completes. NovelAI’s service-side storage is session-transient; browser storage is always subject to deletion. Server-side vault is the system of record for “images we care about keeping.”

### 5.2 Broad library store (DB + files)

Maintain a durable store of assets that make prompting faster and more consistent, including:

- Textual **tags** and multi-tag **snippets**
- **Imagegen settings** presets (steps, guidance, sampler, resolution, model, etc.)
- **Character profiles** and related lore (see §5.3)
- **Vibe references** and related aesthetic refs
- Other images used as **base images**, **inpainting** sources/masks, or director/precise references

Contents of this store are exposed in the **client-side** interface for convenient reuse.

### 5.3 Character profiles and lore repository

First-class records for characters (and, by extension, **settings** and similar story assets) the user reuses often—not limited to image-only references and tags:

- Image references (character / style / combined, as NovelAI supports)
- **Rich textual information**: prose descriptions, bios, personality, relationships, voice/style notes, and other lore the user wants preserved
- Common tags and negative/UC patterns for image work
- Optional links to outfits, snippets, generation presets, and related setting/location records

The lore repository is a **durable server-side store** of this material so it can feed both image prompting and story scaffolding (§5.4).

### 5.4 Story scaffolding for NovelAI text

Provide an **easy path to scaffold a new story** in NovelAI by composing NovelAI-oriented artifacts from saved profiles and lore in our DB, for example:

- **Memory** text
- **Lorebook** entries
- **System prompts** (and similar instruction / context blocks)
- Other reusable story setup text the user chooses to keep or export

This goal is about **authoring and assembling** scaffolding from our repository—not about replacing NovelAI’s text editor in v1. How the composed text lands in NovelAI (copy/export, API, scripting, extension) remains open (see §5.9).

### 5.5 Feedback as a knowledge base

Record user feedback on generated images—likes, ratings, free-text review notes, and similar signals. Purpose: build a structured record of what generations **worked** (and what did not), for later retrieval and analysis. (Feedback models for text outputs may be explored later; image feedback remains the initial focus.)

### 5.6 Extract generation settings from image metadata

Support reading imagegen parameters from generated image files. NovelAI embeds generation metadata in PNG form (including **stealth PNG alpha-channel** storage and ordinary PNG text chunks). Clipboard copy and some save paths may omit metadata; the product should prefer paths that preserve it and implement robust extraction (see RESEARCH.md).

### 5.7 Local-to-server LLM for pattern discovery and text assistance

Use a **local-to-server-layer** LLM (running on our machine, not NovelAI) to:

- Process feedback, library contents, and imagegen settings (pattern discovery for better future **image** generations and usage habits)
- Optionally assist with **text** work and **story scaffolding** (e.g. drafting lorebook-style entries from profile notes)—still operating on **our** stored data / user requests

This path must never trigger unattended NovelAI **image** generation (see §6). Local LLMs are an accepted option for text assistance when the user prefers not to (or not only to) use NovelAI’s text models.

### 5.8 External / paid LLM API (manual only)

Support calling a higher-quality remote LLM API (e.g. Grok) for deeper analysis or drafting. **Always manually initiated by the user** because of cost.

### 5.9 Text generation assistance — UI integration deferred

**In scope as product direction:**

- Assist with **text generation** for NovelAI-oriented storytelling workflows
- Support **local LLMs** as an alternative or complement where the user wants them
- Build and use the **lore repository** and **story scaffolding** outcomes above

**Explicitly deferred / open (not near-term commitments):**

- Whether to **replace**, **extend**, or **leave alone** NovelAI’s built-in text-generation interface (their text UI is already strong)
- Using NovelAI’s **built-in scripting** system, **browser extensions**, and/or **userscripts** as integration paths
- Full custom NovelAI text-generation UI inside Aigen Studio

Pencil these as “figure out later.” Concept and INDEX should not invent a text-UI architecture until that decision is made. Image hard rules (§6) are unchanged.

### 5.10 Longer-term (deferred, not current priority)

- Local-to-server-layer **image generation** (non-NovelAI models on our hardware)
- API access to local LLM / imagegen models served on another machine the user owns

These remain conceptual placeholders so architecture does not paint us into a corner; they are **not** near-term deliverables.

---

## 6. Hard limitation — human-initiated NovelAI *image* generation only

> **HARD LIMITATION:** **ALL** **image** generation done on NovelAI’s services must be **human-initiated at all times**. Automated generation is strictly prohibited by their Terms of Service, and we will not design or implement features that risk an account ban.

**Design consequences (non-negotiable):**

- No batch queues, schedulers, agents, or scripts that call NovelAI **image** generation without an explicit human generate action.
- No “auto-improve by regenerating N variants” loops that hit NovelAI without a click per generation.
- Local LLM analysis, library suggestions, scaffolding helpers, and feedback mining may **propose** prompts/settings/text; they must not **submit** NovelAI **image** jobs by themselves.
- Server-side automation is limited to post-generation work we own: save, index, extract metadata, analyze stored data, and (when designed) compose scaffolding from stored lore.
- An always-on server and multi-device clients do **not** relax this rule: “server is up” never means “server generates images on its own.”

Official terms (e.g. restrictions on automated systems that place excessive strain on the service) reinforce treating NovelAI **image** generation as interactive and human-driven: https://novelai.net/terms/

Text-generation automation policy (NovelAI text APIs vs local LLMs vs scripting) is **not** defined here beyond: do not invent unattended NovelAI **image** jobs under the guise of “text features.”

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
| **Phone** | Vault-first + light create | Browse/search gallery; view metadata; feedback (like/rate/note); pick character/snippet/preset; light lore lookup; **simplified generate** (prompt, UC, seed, limited settings) | Dense multi-panel editors; multi-layer canvas; heavy precise inpaint/mask painting; ultra-dense vibe/ref shelves; heavy lorebook authoring |
| **Tablet** (iPad-focused) | **Robust creative client** | Full-ish generate session: prompts, multi-character as practical, vibes/refs, gallery, library use, **mask/sketch/inpaint-oriented canvas**, feedback; lore browsing/editing as practical | Pure phone-stack layout; treating tablet as “large phone only” |
| **Desktop** | Full power-user density | Everything: widescreen multi-panel layout, bulk library and lore work, story scaffolding, comparison, analysis dashboards, maximum settings density | N/A (superset) |

**Phone** is intentionally reduced: review generations, leave feedback, and light re-rolls—not a full inpainting workstation or heavy lore authoring desk.

**Tablet** is a first-class creative surface (especially iPad), not a zoomed phone layout. Split panes, collapsible rails, and a large canvas region are appropriate.

**Desktop** remains the maximum-density environment for power workflows (including lore repository maintenance and story scaffolding).

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
- Automated NovelAI **image** generation of any kind (see §6)
- Native iOS/Swift or Flutter as the primary client
- **NovelAI text-generation UI** product decisions: replace vs extend vs leave-in-place; NovelAI scripting, browser extensions, and userscripts as the delivery vehicle—**penciled for later** (§5.9)
- Deep research into NovelAI text APIs, lorebook file formats, or scripting internals beyond naming scaffolding outcomes here

---

## 9. Success signals (concept level)

We are succeeding when:

1. After a human generates an image, it (and recoverable settings) reliably land in **our** vault without depending on NovelAI session history.
2. Tags, snippets, characters, vibes, and presets are reusable from the UI without hunting through folders.
3. Character and setting **textual lore** is durable server-side and usable beyond image-only tags/refs.
4. Starting a new NovelAI story can be scaffolded from saved lore (e.g. memory text, lorebook entries, system prompts) without re-assembling everything by hand.
5. Feedback accumulates and can be queried or summarized.
6. Settings can be rehydrated from saved PNG metadata when NovelAI embeds them.
7. Local LLM analysis / assistance can run over our corpus (and help draft scaffolding) without ever firing unattended NovelAI **image** generation; external LLM use is opt-in and explicit.
8. Nothing in the product design depends on unattended NovelAI **image** jobs.
9. A client on another device (e.g. phone or iPad over Tailscale) can use the vault, lore, and human-initiated image generate against the always-on server.
10. Phone, tablet, and desktop each feel intentional—not a single layout poorly scaled—and iPad canvas work is designed with Apple Pencil in mind.
11. Text-generation **UI** integration remains an open decision—scaffolding and lore value do not require shipping a NovelAI text-UI replacement first.

---

## 10. Open questions

Tracked for later design work (not blockers for this concept):

- How tightly we integrate with NovelAI’s official web UI vs. a clean-room client that uses the same **image** APIs.
- Exact metadata extraction stack (official stealth-PNG tools vs. third-party PNG text-chunk round-trip).
- Auth model for single-user multi-device access (e.g. app password vs device tokens vs Tailscale-trust plus local auth)—tailnet reachability alone is not a full app-auth design.
- What “like / rating / review” schema best supports both UI filters and LLM pattern mining.
- How complete the **v1 tablet** surface is (generate + gallery + feedback + Pencil mask first vs also multi-character + full vibe shelves on day one).
- Thumbnail / progressive load strategy for large vaults over Tailscale away from home LAN.
- **NovelAI text path:** replace vs extend vs leave their text UI; NovelAI scripting vs browser extension / userscript vs API-only scaffolding export.
- Lore / profile schema: how far to structure character vs setting vs free-form notes for both image tags and prose scaffolding.
- How story scaffolding outputs are delivered (copy/export files, API push, extension inject, etc.).

See [RESEARCH.md](./RESEARCH.md) for prior art and NovelAI platform facts that inform these decisions (image research is mature; text/lore scaffolding research is not yet a deep pass).
