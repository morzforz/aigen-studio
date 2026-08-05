# Project Knowledge Index

Single source of truth for major project documents. Agents must consult this index before high-level design decisions (see `AGENTS.md`).

| Document | Path | Purpose |
|----------|------|---------|
| Concept | [`docs/CONCEPT.md`](docs/CONCEPT.md) | Product concept for **Aigen Studio** (aigen-studio): dual pillars—NovelAI **image** workflows (vault, libraries, feedback, metadata, human-only image gen) **and** **text** assistance (NovelAI text + optional local LLMs); durable **lore repository** for characters/settings/etc.; **story scaffolding** (memory, lorebook, system prompts); NovelAI text-UI path deferred; domain terms (Service-side / Server-side / Client-side); decoupled always-on server + multi-device web/PWA clients (Tailscale OK); phone / tablet (iPad + Apple Pencil) / desktop surfaces; Mac host; deferred local imagegen. |
| Research | [`docs/RESEARCH.md`](docs/RESEARCH.md) | Research findings for aigen-studio: prior-art image frontends (NAIWeaver, NAI Artist Mixer), NovelAI official image docs (transient history, stealth PNG / metadata, vibe transfer), relevance mapping to image goals; text-gen / lore scaffolding research not yet a deep pass (see CONCEPT). |
| Agent rules | [`AGENTS.md`](AGENTS.md) | Branching, commits, validation, and indexing rules for agentic development. |
