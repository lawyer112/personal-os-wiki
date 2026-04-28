# Personal OS + Personal Wiki

[中文说明](./README.zh-CN.md)

**Not a second brain. A follow-through engine for humans and agents.**

Personal OS + Personal Wiki turns saved links, voice notes, half-formed ideas,
project updates, and agent output into claimed work with evidence.

Most tools help you capture more. This project is for the harder moment after
capture, when the real question is:

> What should happen next? Who owns it? What evidence proves it moved?

If your pain is "I saved it, but nothing happened," this is the missing layer:
a local-first operating loop where humans can think messily and agents can work
against explicit state instead of guessing from chat history.

This repository gives you a local-first operating loop for humans and agents:

```text
capture messy input -> compile durable knowledge -> extract executable tasks
  -> let agents claim work -> review the output -> update the knowledge base
```

It is not another passive notebook. It is a small, local command center for:

- capturing rough thoughts, links, transcripts, files, and project updates;
- turning the durable parts into Markdown Wiki notes;
- turning the actionable parts into tasks with owners, status, and review gates;
- giving agents a stable API to poll, claim, execute, heartbeat, and submit;
- keeping private runtime data outside the public repository.

## Why This Exists

Bookmarks become graveyards. Notes become archives. Chat history becomes fog.
Agents get smarter, but they still lose context unless the work has a shared
state machine.

Personal OS + Personal Wiki makes the handoff explicit:

- **Personal Wiki** is the memory: Markdown notes, concepts, tags, backlinks,
  search, and graph data.
- **Personal OS** is the work state: Inbox, Ideas, Tasks, Projects, Today,
  agent runs, task claims, reviews, and notification payloads.
- **Agent Guide** is the contract: agents do not guess what to do from chat
  history; they read a manual and call APIs.

The opinionated bet: a useful personal knowledge base should not only remember
what you saw. It should help decide what is unfinished, what matters next, and
which agent can push it forward.

## What You Get

- A Next.js + Postgres Personal OS app for inbox, ideas, tasks, projects, and
  agent task execution.
- A Python Markdown Wiki with ingest, search, tags, concepts, graph data,
  browser pages, and read/write token boundaries.
- Agent-facing APIs for context loading, task claiming, heartbeats,
  contributions, submission, and review.
- Local-first defaults: no private vault, database, token, cookie, or server
  inventory belongs in Git.
- CI that verifies tests, audit, typecheck, lint, app build, Docker builds, Wiki
  compile, and secret scanning.

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
  |-- heartbeat while working
  |-- submit contribution and artifacts
  v
Human or reviewer agent approves, requests changes, blocks, or archives
```

The important boundary is simple: Personal OS owns work state. Personal Wiki
owns durable knowledge. Agents connect the two.

## Human Workflow

1. Drop everything into one intake path: a link, a project concern, a voice
   note, a server observation, or an unfinished idea.
2. The intake flow preserves the raw input in Inbox.
3. Knowledge-worthy material becomes readable Markdown.
4. Execution-worthy material becomes a task with a next action and definition
   of done.
5. Agents poll tasks by tags such as `wiki`, `research`, `coding`, `ops`, or
   `review`.
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

This project should stay as a monorepo while Personal OS, Personal Wiki, and
the agent protocol are still changing together. Split repositories later only
if the Wiki becomes independently useful without Personal OS, or if developers
want to embed only one component.

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

This is an early public release. It is useful for builders who want to study or
adapt a local-first agent workbench, but it is not a hosted SaaS product and it
does not include your private knowledge base. Treat it as an engine, not as a
cloud service.
