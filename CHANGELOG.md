# Changelog

All notable changes to Personal OS + Personal Wiki are tracked here.

This project uses semantic versioning for public release packages. The root
`VERSION` file is the release version for the whole repository.

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
