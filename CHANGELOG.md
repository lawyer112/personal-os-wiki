# Changelog

All notable changes to Personal OS + Personal Wiki are tracked here.

This project uses semantic versioning for public release packages. The root
`VERSION` file is the release version for the whole repository.

## Unreleased

## 0.2.0 - Unreleased

### Added

- First-class agent execution audit records with `TaskRun`,
  `AgentActionLog`, policy snapshots, claim release reasons, and visible task
  execution trails.
- Separate Today lanes for intake task confirmation and submitted execution
  review, so `review` no longer mixes "new candidate task" with "agent result
  awaiting approval".
- Configurable write API rate limiting for Personal OS.
- Personal Wiki `source_hash` reverse index for faster ingest deduplication.
- Optional Personal Wiki CORS configuration for protected cross-service calls.
- Configurable Docker port bind addresses for Personal OS and Personal Wiki,
  so public defaults can stay localhost-only while a private LAN deployment can
  opt in to LAN binding from `.env`.
- Chinese API overview and agent job orchestration docs, plus a bilingual
  release rule for public documentation surfaces.
- Bilingual Obsidian bridge plan that defines the plugin as a thin read/capture
  adapter rather than a second task database or private-vault sync source.
- Folder Inbox mode for the Obsidian bridge direction: paste links/text into a
  dedicated vault folder, scan new blocks, and deduplicate before ingestion.
- macOS/Linux demo helper script: `sh ./scripts/demo.sh`.
- README, Getting Started, and Releases now document platform-specific demo
  helpers before the raw Docker Compose command.
- Bilingual README/demo walkthrough media and reviewer-oriented walkthrough
  documentation.
- Demo seed data now includes a fake task claim, submitted evidence, and an
  approved review decision.
- Web capture can store raw links as Inbox items without spending LLM tokens.
- Task execution guardrails: `executionMode`, high-risk claim blocking,
  policy/profile re-checks while a lease is active, and profile/tag/risk-aware
  `AgentProfile` filtering for agent work queues.
- Agent context packs now include hot/warm/cold tiers, `nextAction` guidance,
  evidence episodes, and task/wiki/activity recall for follow-on agents.
- Daily planner snapshots can persist the user-facing plan that was actually
  delivered, with a read endpoint for later inspection.
- GitHub radar intake script with source registry, deduplication, and skip-seen
  support for turning external repository signals into Personal OS tasks.
- Raw manifest ingestion, classic knowledge object schemas, and validation tests
  for structured knowledge intake.
- Personal Wiki graph relation tests and dependencies for safer graph/search
  behaviour.

### Changed

- Public-safe maintenance manuals now define the project handoff process and the
  private/public record boundary without publishing private product priorities.
- README maps and service topology docs now make the Personal OS / Personal Wiki
  split clearer.
- Public roadmap content stays at boundary level; private operating priorities
  remain out of the public repository.
- Personal Wiki read and write clients are split so read-token and write-token
  responsibilities are explicit.
- Documentation now emphasizes that GitHub contains the reusable engine only;
  populated vaults, task history, logs, server inventories, and private UI files
  stay local.

### Fixed

- `/api/intake` Wiki fallback handling can preserve Inbox/AgentRun state when a
  Wiki write fails instead of losing the whole intake chain.
- GitHub radar intake now sends `wikiNotes.title`, preventing schema validation
  failures during intake.
- Wiki ingest validation accepts optional frontmatter fields needed by the
  production Personal Wiki frontmatter contract.
- CI no longer runs a raw-manifest ingest test without its script dependency.
- Developer experience walkthrough layout and neutral reviewer paths were
  cleaned up.

### Security

- Web app dependency security updates from Dependabot are included.
- Release and data-safety docs reaffirm that real `.env` files, tokens, cookies,
  private vaults, Personal OS databases, logs, screenshots, server inventories,
  and generated runtime artifacts are excluded from Git.

### Changed

- Agent heartbeat, contribution, and submit mutations now use conditional
  policy/lease writes instead of relying only on a prior read.
- Submitting work clears `ownerAgent`/`leaseUntil`, releases active claims, and
  moves the active task run to `submitted`.
- Review decisions write back to submitted task runs as `approved`,
  `changes_requested`, `rejected`, `blocked`, or `archived`.
- The capture bookmarklet now uses `NEXT_PUBLIC_APP_URL` instead of hard-coded
  localhost.

### Security

- Personal OS configured data paths are constrained to the app `data`
  directory.
- Personal OS read/write token checks use timing-safe digest comparison.
- Daily planner timezone input now rejects invalid IANA timezone names.
- Personal Wiki inline JSON escaping now escapes `<`, `>`, `&`, U+2028, and
  U+2029 for script contexts.
- Personal Wiki write authorization uses constant-time token comparison.

## 0.1.1 - 2026-04-29

Conversion-focused public release.

### Added

- One-command root Docker demo with fake seed data:
  `docker compose up -d --build`.
- README first-screen positioning, 60-second visual proof, and clearer
  English/Chinese onboarding path.
- Comparison docs for Personal OS vs agent long-term memory vs Obsidian task
  plugins.
- Launch playbook and GitHub Traffic snapshot helper.
- Bug report and feature request issue templates.
- Five `good first issue` starter tasks for contributors.

## 0.1.0 - 2026-04-29

Initial public review release.

### Added

- Personal OS Next.js app with Inbox, Ideas, Projects, Tasks, Notes, Today,
  agent runs, task claiming, heartbeats, submissions, and review flow.
- Personal Wiki Python service with Markdown ingest, search, note pages, graph
  data, tags, concepts, and read/write token boundaries.
- Agent operating docs, copyable prompts, API overview, Hermes contract, and
  Mac notification adapter manual.
- Local-first deployment docs, data-safety docs, repository permission guidance,
  and open-source release checklist.
- Versioned release package script for `.zip`, `.tar.gz`, and `SHA256SUMS.txt`.

### Security

- Default demo services bind to localhost unless explicitly exposed.
- Personal OS read APIs and Wiki browser handoff require read-token access.
- Wiki localhost read bypass is disabled by default and must be explicitly
  enabled for trusted development setups.
