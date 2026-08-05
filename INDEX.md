# Project Knowledge Index

Single source of truth for major project documents. Agents must consult this index before high-level design decisions (see `AGENTS.md`).

| Document | Path | Purpose |
|----------|------|---------|
| Concept | [`docs/CONCEPT.md`](docs/CONCEPT.md) | Product concept for **Aigen Studio** (aigen-studio): dual pillars—NovelAI **image** workflows (vault, libraries, feedback, metadata, human-only image gen) **and** **text** assistance (NovelAI text + optional local LLMs); durable **lore repository** for characters/settings/etc.; **story scaffolding** (memory, lorebook, system prompts); NovelAI text-UI path deferred; domain terms (Service-side / Server-side / Client-side); decoupled always-on server + multi-device web/PWA clients (Tailscale OK); phone / tablet (iPad + Apple Pencil) / desktop surfaces; Mac host; deferred local imagegen. |
| Roadmap | [`docs/ROADMAP.md`](docs/ROADMAP.md) | Living build milestones (M0 architecture → M1 scaffold → M2 lore repo → M3 story scaffolding → M4 image path → M5 libraries/feedback/LLM; deferred L1 text-UI / L2 local imagegen). Agents mark milestones Implemented and update when requirements change (see `AGENTS.md`). |
| Research | [`docs/RESEARCH.md`](docs/RESEARCH.md) | Research findings for aigen-studio: prior-art image frontends (NAIWeaver, NAI Artist Mixer), NovelAI official image docs (transient history, stealth PNG / metadata, vibe transfer), relevance mapping to image goals; text-gen / lore scaffolding research not yet a deep pass (see CONCEPT). |
| Agent rules | [`AGENTS.md`](AGENTS.md) | Branching, commits, validation, indexing, and **roadmap maintenance** rules for agentic development. |
