# Personal OS + Personal Wiki

[中文说明](./README.zh-CN.md)

Personal OS + Personal Wiki is a local-first workbench for turning messy human
inputs into durable knowledge, executable tasks, and agent-readable context.

The project is built around one practical loop:

```text
capture -> understand -> write knowledge -> create tasks -> let agents claim work
        -> review outputs -> update the knowledge base
```

It is not a hosted SaaS product and it is not a dump of a private vault. The
repository contains the reusable engine: source code, schema, API contracts,
tests, Docker examples, and documentation. Runtime data, private notes,
credentials, server inventories, task history, and personal reminders must stay
outside Git.

The default deployment posture is local-first. Production compose examples bind
the Personal OS web app to localhost; expose it to LAN or the Internet only
behind an authenticated reverse proxy.

## Why This Exists

Most personal knowledge systems stop at collection. Links are saved, notes are
written, and reminders pile up, but nothing reliably turns that material into
the next useful action. This project treats the knowledge base as an operating
surface for agents:

- The user can send rough thoughts, links, transcripts, project updates, or
  "rambling" ideas.
- Personal Wiki stores the long-term Markdown memory: notes, concepts, tags,
  backlinks, search, and graph data.
- Personal OS stores execution state: inbox, ideas, tasks, projects, agent
  runs, task claims, reviews, and notification payloads.
- Agents use stable APIs instead of guessing from chat history or scraping the
  entire vault.
- The system is designed to push work forward: unfinished tasks remain visible,
  agents can claim tasks by tag, and outputs are reviewed before becoming final.

## Components

| Component | Path | Role |
| --- | --- | --- |
| Personal OS | [`personal-os-app/`](./personal-os-app) | Next.js + Postgres workbench for Inbox, Ideas, Tasks, Projects, Today planning, notifications, and agent task execution. |
| Personal Wiki | [`personal-wiki/`](./personal-wiki) | Python Markdown wiki with ingestion, search, graph data, browser pages, auth handoff, and agent maintenance APIs. |
| Agent contract | [`docs/AGENT_GUIDE.md`](./docs/AGENT_GUIDE.md) | The operating manual that tells Hermes, Codex, or any other agent how to capture, route, claim, execute, and review work. |
| Release boundary | [`OPEN_SOURCE_RELEASE.md`](./OPEN_SOURCE_RELEASE.md) | The safety checklist for publishing the software without leaking private data. |

## Architecture In One Picture

```text
Human input
  |  text, link, file summary, voice transcript, project update
  v
Personal OS /api/intake
  |-- InboxItem: original trace
  |-- Idea: not-yet-actionable thought
  |-- Task: executable next action
  |-- ProjectEvent: project timeline
  |-- AgentRun: what an agent decided
  |
  +--> Personal Wiki /api/ingest
       |-- Markdown note
       |-- tags and concepts
       |-- search index
       |-- graph links

Worker agents
  |-- poll /api/agent-inbox
  |-- claim /api/tasks/:id/claim
  |-- read /api/agent/context
  |-- submit contribution and artifacts
  v
Human or reviewer agent approves, requests changes, blocks, or archives
```

The important boundary is simple: Personal OS owns work state. Personal Wiki
owns durable knowledge. Agents connect the two.

## Human Workflow

1. Capture everything in one place: a link, a project concern, a voice note, a
   server observation, or an unfinished idea.
2. The intake flow preserves the raw input in Inbox.
3. Knowledge-worthy material is written to the Wiki as readable Markdown.
4. Execution-worthy material becomes tasks with a concrete next action and a
   definition of done.
5. Agents poll tasks by tags such as `wiki`, `research`, `coding`,
   `ops`, or `review`.
6. Work is not complete just because an agent wrote something. The agent
   submits evidence, artifacts, and a review request.

## Agent Workflow

Agents should not improvise their own protocol. The minimum execution loop is:

```text
poll -> claim -> load context -> execute -> heartbeat -> contribute -> submit -> review
```

The full manual is in [`docs/AGENT_GUIDE.md`](./docs/AGENT_GUIDE.md). The lower
level API reference for Hermes-style integrations is in
[`personal-os-app/docs/HERMES_API.md`](./personal-os-app/docs/HERMES_API.md).

## Local Development

Personal OS:

```bash
cd personal-os-app
cp .env.example .env
docker compose up -d postgres
npm ci
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Personal Wiki:

```bash
cd personal-wiki
cp .env.example .env
docker compose up -d --build
```

Default local URLs:

```text
Personal OS:   http://localhost:3000
Personal Wiki: http://localhost:3422
```

## Verification

Run these before publishing or asking another agent to review the package:

```bash
cd personal-os-app
npm ci
npm run prisma:generate
npm test
npm audit --omit=dev --audit-level=moderate
npx tsc --noEmit
npm run build

cd ../personal-wiki
python -m py_compile api/server.py
```

## Data Safety

Safe to commit:

- application source code
- tests
- documentation
- `.env.example` templates
- Docker and compose files that use placeholders
- fake demo data

Never commit:

- `.env` files or agent credential exports
- populated wiki vaults
- server inventory with private LAN addresses, ports, paths, or business mapping
- real inbox messages, task history, reminders, or project notes
- logs, pid files, generated bundles, screenshots, `.next`, `node_modules`

Before pushing to a public repository, run a final secret scan and publish from
a clean/squashed history that never contained private deployment artifacts.

## Repository Strategy

This package should stay as one private review repository while the OS, Wiki,
and agent protocol are still changing together. A split into separate public
repositories is useful later only if the Wiki becomes independently useful
without Personal OS, or if other developers want to embed only one component.

Detailed strategy:

- [Repository strategy, English](./docs/REPOSITORY_STRATEGY.md)
- [仓库拆分与开源策略，中文](./docs/REPOSITORY_STRATEGY.zh-CN.md)

## Documentation Map

- [Architecture](./docs/ARCHITECTURE.md)
- [架构说明](./docs/ARCHITECTURE.zh-CN.md)
- [Agent guide](./docs/AGENT_GUIDE.md)
- [Agent 使用手册](./docs/AGENT_GUIDE.zh-CN.md)
- [Open source release process](./OPEN_SOURCE_RELEASE.md)
- [Security policy](./SECURITY.md)
- [Repository permissions](./docs/PERMISSIONS.md)
- [Contributing](./CONTRIBUTING.md)
- [Personal OS README](./personal-os-app/README.md)
- [Personal Wiki README](./personal-wiki/README.md)

## Project Status

This tree is a public-release candidate. It is safe to review in the private
staging repository, but the public repository should be created from a clean
squashed or orphan history after the final review. The remaining release gates
are Docker verification, dependency audit review, demo data review, and one more
documentation pass.
