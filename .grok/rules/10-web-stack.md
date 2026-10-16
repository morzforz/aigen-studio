# Web stack baseline

Keep this file thin; prefer repo README and package scripts as source of truth for commands.

- Use the project’s existing package manager (npm/pnpm/yarn/bun) and do not switch without an explicit request.
- Run the project’s documented lint, type-check, test, and build scripts after meaningful changes.
- Prefer framework idioms already used in the codebase (routing, state, styling) over introducing a second pattern.
- Keep secrets out of the repo; use env files already documented by the project.
