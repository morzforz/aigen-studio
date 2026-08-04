# Project Knowledge Index

Single source of truth for major project documents. Agents must consult this index before high-level design decisions (see `AGENTS.md`).

| Document | Path | Purpose |
|----------|------|---------|
| Concept | [`docs/CONCEPT.md`](docs/CONCEPT.md) | Product concept for ImageGen Studio: domain terms (Service-side / Server-side / Client-side); decoupled always-on server + multi-device web/PWA clients (Tailscale OK); phone / tablet (iPad + Apple Pencil) / desktop surface roles; main goals (auto-save vault, libraries, character profiles, feedback KB, metadata extract, local + manual external LLM analysis); hard human-only NovelAI generation rule; Mac host platform; deferred local imagegen. |
| Research | [`docs/RESEARCH.md`](docs/RESEARCH.md) | Research findings on prior-art frontends (NAIWeaver, NAI Artist Mixer), NovelAI official docs (transient history, stealth PNG / metadata, vibe transfer), and relevance mapping to our goals. |
| Agent rules | [`AGENTS.md`](AGENTS.md) | Branching, commits, validation, and indexing rules for agentic development. |
