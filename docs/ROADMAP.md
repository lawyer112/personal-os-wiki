# Roadmap

This project is an early public engine, not a polished hosted product. The
roadmap is organized around making the agent work loop more understandable,
safer, and easier to adopt.

## Now

- Clearer GitHub landing docs.
- Fake demo dataset for first-run onboarding.
- CI for tests, audit, typecheck, lint, app build, Docker builds, Wiki compile,
  and secret/private-data scan.
- Token boundaries for Personal OS and Personal Wiki.
- Agent task protocol: poll, claim, heartbeat, contribute, submit, review.

## Next

- Built-in demo agent or smoke worker that polls, claims, submits evidence, and
  waits for review.
- Review dashboard focused on evidence, artifacts, definition of done, and
  approve/request-changes decisions.
- Task execution policy fields such as `executionMode` so agents know whether a
  task is manual, suggested, directly allowed, or approval-required.
- Agent capability registry so work can be matched to agents by safe abilities,
  not tags alone.
- First-class `TaskRun` and structured action logs for auditable execution
  attempts.
- MCP server for tools and external agents that need standard access to tasks,
  context, and Wiki evidence.
- Object-knowledge rebuild: make Wiki notes typed, explainable, and usable as
  agent-maintained project/workflow/evidence objects. See
  [Object Knowledge Rebuild Manual](./OBJECT_KNOWLEDGE_REBUILD_MANUAL.md).
- Public screenshots using fake seed data only.
- A browser walkthrough for Today, Inbox, Tasks, Projects, Ideas, Wiki, and
  Agent Context.
- More copyable API examples and smoke scripts.
- Better first-run checks for token mismatch between Personal OS and Personal
  Wiki.
- More tests around failure paths in task claims, stale leases, review decisions,
  and Wiki ingest errors.

## Later

- Agent self-assignment by capability tags.
- Richer project dashboards and revenue/work-priority views.
- Knowledge graph insights, local graph views, Wiki lint, and knowledge-gap
  tasks generated into Personal OS.
- Safer import/export for existing Markdown vaults.
- Optional notification adapters beyond Telegram-style payloads.
- Optional OpenAPI/Bruno/Postman artifacts for API consumers.

## Not Goals For The Current Release

- Hosted SaaS.
- Multi-tenant organization management.
- OAuth/user-account system.
- Fully autonomous agents that can bypass review.
- Publishing real private vaults or server inventories.
- Replacing Obsidian, Logseq, Notion, or your editor.

The goal is narrower: make personal knowledge actionable and make agent work
claimable, reviewable, and resumable.
