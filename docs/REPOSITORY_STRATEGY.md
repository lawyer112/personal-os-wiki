# Repository Strategy

The short answer: publish the first public version as a monorepo. Split
repositories later only when the component boundaries become stable and there is
a real external reason to consume one component without the other.

## Recommended Shape Now

```text
personal-os-wiki/
  personal-os-app/
  personal-wiki/
  docs/
  README.md
  README.zh-CN.md
  OPEN_SOURCE_RELEASE.md
```

This shape is recommended because the project is still evolving as one product:

- Personal OS intake can write Wiki notes.
- Personal OS context can fetch Wiki candidates.
- The task protocol depends on Wiki evidence links.
- Browser auth handoff crosses OS/Wiki boundaries.
- Documentation needs to explain the whole loop, not just one service.

For the staging and first public release, a monorepo is easier to inspect,
clone, test, and scrub.

## What Must Not Become A Repository

Do not create a public repository from:

- the live Markdown vault
- runtime data directories
- server ledgers
- reminder/task history
- screenshots and logs
- local agent env folders
- exported review bundles that contain private context

The public repository is the engine. The private machine is the memory.

## Public Release Phases

### Phase 0: Private Staging

Use the private GitHub repository for review. Ask agents or trusted humans to
review:

- build correctness
- secret leakage
- data leakage
- documentation clarity
- install flow
- license choice

### Phase 1: Public Monorepo

Create one clean-history public repository only after:

- a license is chosen
- a fresh clone can run the quickstart
- secret scan is clean
- demo data is fictional
- docs explain the data boundary
- production compose requires explicit secrets

This is the best first public shape because users can understand the whole
Personal OS + Personal Wiki + Agent loop in one place.

### Phase 2: Split Repositories If Needed

Split only if there is real demand or independent stability:

```text
personal-os-app
personal-wiki
personal-os-agent-protocol
personal-os-examples
```

Splitting is useful when:

- Personal Wiki can be installed and used without Personal OS.
- Personal OS can support other knowledge backends.
- The API contracts are stable enough to version.
- CI and Docker quickstarts work independently.
- External contributors mostly touch one component.

Splitting too early increases documentation cost, version drift, and install
friction.

## Agent Wiki Question

"Agent-facing Wiki" does not have to be a separate repository at first. It is a
contract and documentation layer:

- Wiki stores durable Markdown knowledge.
- Personal OS stores task and review state.
- `docs/AGENT_GUIDE.md` tells agents how to use both.
- `personal-os-app/docs/HERMES_API.md` defines the API details.

If the agent guide grows into a reusable protocol that other projects adopt,
then it can become a small standalone repository later.

## Packaging Rules

Before public release:

- Keep `.env.example`; remove `.env`.
- Keep fake demo data; remove real data.
- Keep docs; remove private handoff notes.
- Keep API tests; remove generated artifacts.
- Keep Docker examples; require explicit production secrets.
- Keep localhost defaults; avoid private hostnames, private domains, and private
  network topology.

## Naming

Good public repository names:

- `personal-os-wiki`
- `agentic-personal-os`
- `local-first-agent-wiki`

Avoid names that imply this repository contains a real personal vault or a
hosted cloud service.

## Decision

Use one repository for the first public release. Treat repository splitting as a
future scaling move, not as a prerequisite for publishing.
