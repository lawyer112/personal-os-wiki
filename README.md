# Personal OS + Personal Wiki

<p align="center">
  <img src="./docs/assets/readme/hero.en.svg" alt="Personal OS + Personal Wiki hero: Stop collecting. Start closing loops." width="100%">
</p>

[![CI](https://github.com/lawyer112/personal-os-wiki/actions/workflows/ci.yml/badge.svg)](https://github.com/lawyer112/personal-os-wiki/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Local First](https://img.shields.io/badge/local--first-yes-2ea44f)](#data-safety)
[![Agent Ready](https://img.shields.io/badge/agent--ready-task%20claiming-blue)](#agent-protocol)
[![Markdown Wiki](https://img.shields.io/badge/markdown-wiki-7c3aed)](#personal-wiki)
[![Task Protocol](https://img.shields.io/badge/task-protocol-f97316)](#agent-protocol)

<p align="center">
  <a href="#10-minute-demo-path"><img src="https://img.shields.io/badge/Run%20the%20demo-10%20minutes-0f766e?style=for-the-badge" alt="Run the demo"></a>
  <a href="./README.zh-CN.md"><img src="https://img.shields.io/badge/中文说明-完整中文版-dc2626?style=for-the-badge" alt="中文说明"></a>
  <a href="./docs/GETTING_STARTED.md"><img src="https://img.shields.io/badge/Getting%20Started-guide-1d4ed8?style=for-the-badge" alt="Getting Started"></a>
  <a href="./docs/DEPLOYMENT.md"><img src="https://img.shields.io/badge/Deployment-requirements-0f766e?style=for-the-badge" alt="Deployment requirements"></a>
  <a href="./docs/AGENT_GUIDE.md"><img src="https://img.shields.io/badge/Agent%20Guide-protocol-7c3aed?style=for-the-badge" alt="Agent Guide"></a>
  <a href="./docs/AGENT_PROMPT.md"><img src="https://img.shields.io/badge/Agent%20Prompt-copyable-9333ea?style=for-the-badge" alt="Agent Prompt"></a>
  <a href="./docs/API_OVERVIEW.md"><img src="https://img.shields.io/badge/API-overview-f97316?style=for-the-badge" alt="API Overview"></a>
  <a href="./docs/DATA_SAFETY.md"><img src="https://img.shields.io/badge/Data%20Safety-local--first-334155?style=for-the-badge" alt="Data Safety"></a>
</p>

[中文说明](./README.zh-CN.md)

**Category:** local-first agent workbench, Markdown knowledge base, task
execution protocol.

<details>
<summary><strong>中文速览：这不是第二大脑，是推进引擎</strong></summary>

Personal OS + Personal Wiki 把收藏夹、语音转写、碎碎念、项目进展和 Agent 产物，变成有人认领、有人提交证据、有人复核的任务。

它的核心闭环是：

```text
碎片输入 -> Wiki 长期记忆 -> 可执行任务
  -> Agent 认领 -> 提交证据 -> 人或 Reviewer 复核
  -> 结果回写知识库，供下一轮继续使用
```

完整中文说明见 [README.zh-CN.md](./README.zh-CN.md)。

</details>

**Not a second brain. A follow-through engine for humans and agents.**

Personal OS + Personal Wiki turns saved links, voice notes, rough ideas,
project updates, and agent output into claimed work with evidence.

Most tools help you collect more. This project is for the harder moment after
collection:

> What should happen next? Who owns it? What evidence proves it moved?

If your pain is "I saved it, summarized it, and still nothing shipped," this is
the missing layer: a local-first operating loop where humans can think messily
and agents work against explicit state instead of guessing from chat history.

```text
messy input -> durable wiki memory -> executable tasks
  -> agent claim -> evidence submission -> human/reviewer approval
  -> knowledge base updated for the next run
```

<p align="center">
  <img src="./docs/assets/readme/loop.svg" alt="Capture, Wiki, Task, Agent, Review loop" width="100%">
</p>

## What This Project Is

Personal OS + Personal Wiki is a local-first workbench for people who want AI
agents to help them move real projects forward, not just summarize notes.

It gives you three connected layers:

| Layer | Job | Why it matters |
| --- | --- | --- |
| **Personal OS** | Inbox, ideas, projects, tasks, today view, agent runs, task claims, reviews, notifications. | This is the execution state. It says what is unfinished, who owns it, and what counts as done. |
| **Personal Wiki** | Markdown notes, concepts, tags, backlinks, search, graph data, browser pages, sanitized long-term memory. | This is the durable knowledge base. It preserves context without dumping private runtime data into Git. |
| **Agent Guide** | A written operating manual and API contract for Hermes, Codex, or any other worker agent. | Agents do not improvise from chat history. They read the manual, call APIs, claim work, submit evidence, and wait for review. |

The project is opinionated: a useful personal knowledge base should not only
remember what you saw. It should expose what is still unfinished and make it
easy for another agent to push the work forward.

## What You Can Do With It

| Use case | What happens |
| --- | --- |
| Save links that usually die in bookmarks | Capture the raw link, summarize it into Wiki memory, and extract follow-up tasks. |
| Dump "rambling" project thoughts | Preserve the original Inbox item, turn the stable part into knowledge, and turn the actionable part into tasks. |
| Run several agents against one backlog | Agents poll tasks by tags, claim work, heartbeat while working, submit contributions, and request review. |
| Keep a private project brain without leaking data | Source code and fake examples go to Git; real vaults, tokens, server inventories, and task history stay local. |
| Build a revenue/work dashboard | Projects, today view, unfinished tasks, and review queues make "what moves the project" visible. |
| Use the Wiki as agent memory | Agents can read curated Markdown context instead of relying on stale chat history. |

## Feature Overview

### Personal OS

- Inbox for raw human input and agent observations.
- Ideas, projects, tasks, notes, activity feed, and Today workspace.
- Agent-facing task protocol: inbox polling, claim, heartbeat, contribution,
  submit, review, block, archive.
- Read and write token boundaries for agent integrations.
- Planner and notification payloads for daily guidance.
- Next.js app backed by PostgreSQL and Prisma.

### Personal Wiki

- Markdown vault with browser pages.
- Ingest API for writing notes from agents or local tools.
- Search, tags, concepts, graph data, backlinks, and wiki-style navigation.
- Separate read and write token defaults.
- Docker-friendly Python service.
- Compatible with the "Markdown as durable memory" workflow.

### Agent Workflow

Agents use a predictable loop:

```text
poll -> claim -> load context -> execute -> heartbeat -> contribute -> submit -> review
```

That loop is the difference between "an agent wrote something in a chat" and
"a task was claimed, worked, evidenced, and reviewed."

## Deployment Requirements

Recommended path: Docker Compose on a Linux host, with app ports bound to
localhost and exposed only through an authenticated HTTPS reverse proxy.

| Item | Recommendation |
| --- | --- |
| Host | Linux server, macOS, or Windows with WSL2/Docker Desktop |
| Minimum size | 2 CPU cores, 2 GB RAM, 10 GB free disk |
| Comfortable size | 4 CPU cores, 4-8 GB RAM, 20+ GB disk plus backups |
| Required tools | Docker Compose, Git, `curl`; Node.js 24+ for local OS development |
| Main ports | Wiki `3422`, OS dev `3000`, OS prod `3100`, local Postgres `54329` |
| Data to back up | Wiki data directory, Postgres database, and out-of-Git secret storage |

Docker is recommended, not mandatory. Operators can also run Personal Wiki as a
Python service and Personal OS as a Node.js service, but then they own process
supervision, upgrades, TLS, authentication, and backups.

Read the full deployment guide:
[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## 10-Minute Demo Path

This is the fastest way to understand the system locally.

### 1. Start Personal Wiki

```bash
cd personal-wiki
cp .env.example .env
docker compose up -d --build
```

Open:

```text
http://localhost:3422
```

### 2. Start Personal OS

```bash
cd ../personal-os-app
cp .env.example .env
docker compose up -d postgres
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Open:

```text
http://localhost:3000
```

For the full OS/Wiki integration, set `WIKI_API_TOKEN` and `WIKI_READ_TOKEN` in
`personal-os-app/.env` to match `personal-wiki/.env`.

### 3. Try the loop

After seeding, you should see fictional demo data:

| Surface | Demo item |
| --- | --- |
| Projects | `Acorn Launch Lab` |
| Inbox | `Demo input: collect three customer notes...` |
| Tasks | `Review the fictional launch checklist` |
| Ideas | `Add a demo screenshot after UI polish` |
| Notes | `Demo launch checklist` |

Suggested path:

1. Open `Today` to see the current work queue.
2. Open `Tasks` and inspect `Review the fictional launch checklist`.
3. Check the next action, definition of done, Wiki link, contribution, and
   artifact.
4. Open `Projects` and inspect `Acorn Launch Lab`.
5. Open `Ideas` and confirm the screenshot idea stayed as an idea instead of
   being forced into a task.

The full walkthrough is in
[`docs/GETTING_STARTED.md`](./docs/GETTING_STARTED.md).

## Screenshots

Public screenshots should use fake seed data only. The screenshot capture list
is tracked in [`docs/assets/screenshots/README.md`](./docs/assets/screenshots/README.md).

Planned captures:

- Today workspace
- Task review flow
- Project timeline
- Agent context panel
- Wiki note graph

## Architecture

<p align="center">
  <img src="./docs/assets/readme/architecture.svg" alt="Personal OS owns work state. Personal Wiki owns durable knowledge. Agent Guide connects them." width="100%">
</p>

```text
Human input
  |  links, voice transcripts, project notes, file summaries, rough thoughts
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

The important boundary is simple:

```text
Personal OS   = work state
Personal Wiki = durable knowledge
Agent Guide   = portable operating rules
```

Read more:

- [Architecture](./docs/ARCHITECTURE.md)
- [Agent Guide](./docs/AGENT_GUIDE.md)
- [Copyable Agent Prompt](./docs/AGENT_PROMPT.md)
- [Hermes API contract](./personal-os-app/docs/HERMES_API.md)

## Agent Protocol

An agent should not scrape the whole vault or guess from chat history. It should
follow the contract.

Example task claiming flow:

```bash
# 1. Poll work
curl -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  "http://localhost:3000/api/agent-inbox?agentId=research-agent&tags=wiki,research"

# 2. Claim one task
curl -X POST \
  -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"research-agent","leaseMinutes":30}' \
  "http://localhost:3000/api/tasks/<task-id>/claim"

# 3. Load context
curl -H "Authorization: Bearer $PERSONAL_OS_READ_TOKEN" \
  "http://localhost:3000/api/agent/context?taskId=<task-id>"

# 4. Submit evidence when done
curl -X POST \
  -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"research-agent","summary":"What changed","artifactUrls":["https://example.com/demo"],"evidenceLinks":["wiki://demo/demo-launch-checklist.md"],"definitionOfDoneMet":true,"needsHumanDecision":true}' \
  "http://localhost:3000/api/tasks/<task-id>/submit"
```

For the complete protocol, read
[`docs/AGENT_GUIDE.md`](./docs/AGENT_GUIDE.md) and
[`docs/API_OVERVIEW.md`](./docs/API_OVERVIEW.md).

## What Makes This Different From A Normal Wiki

| Normal note app | This project |
| --- | --- |
| Stores notes | Stores knowledge and extracts execution state |
| Search is the main interface | Tasks, Today, projects, graph, and agent context all matter |
| AI summarizes content | Agents can claim work and submit reviewable evidence |
| Links can disappear into an archive | Links can become Wiki pages and follow-up tasks |
| "Done" means text was written | "Done" means a task was reviewed or explicitly archived |
| Private data often gets mixed with code | Runtime data is designed to stay outside Git |

## Data Safety

This repository is the reusable engine, not a dump of a private life or private
infrastructure.

Safe to commit:

- application source code
- tests
- documentation
- `.env.example` templates
- Docker and compose files that use placeholders
- fake demo data

Never commit:

- `.env` files or agent credential exports
- populated Wiki vaults
- real inbox messages, task history, reminders, or project notes
- server inventory with private LAN addresses, ports, paths, or business mapping
- logs, pid files, generated bundles, screenshots, `.next`, `node_modules`

Read the full release checklist:

- [Data safety](./docs/DATA_SAFETY.md)
- [Open source release process](./OPEN_SOURCE_RELEASE.md)
- [Security policy](./SECURITY.md)
- [Repository permissions](./docs/PERMISSIONS.md)

## Documentation Map

| Goal | Read |
| --- | --- |
| Understand the product | This README |
| Run it locally | [Getting Started](./docs/GETTING_STARTED.md) |
| Check deployment requirements | [Deployment Guide](./docs/DEPLOYMENT.md) |
| Understand architecture | [Architecture](./docs/ARCHITECTURE.md) |
| Connect an agent | [Agent Guide](./docs/AGENT_GUIDE.md), [Agent Prompt](./docs/AGENT_PROMPT.md), [API Overview](./docs/API_OVERVIEW.md), and [Hermes API](./personal-os-app/docs/HERMES_API.md) |
| Operate Personal OS | [Personal OS README](./personal-os-app/README.md) |
| Operate Personal Wiki | [Personal Wiki README](./personal-wiki/README.md) and [Wiki usage](./personal-wiki/docs/USAGE.md) |
| Understand data safety | [Data safety](./docs/DATA_SAFETY.md) |
| Publish safely | [Open source release process](./OPEN_SOURCE_RELEASE.md) |
| Decide monorepo vs split repos | [Repository strategy](./docs/REPOSITORY_STRATEGY.md) |
| See what is next | [Roadmap](./docs/ROADMAP.md) |

## Roadmap

The short version:

- Improve public screenshots and the browser walkthrough.
- Add more agent task-claiming examples and smoke scripts.
- Improve task extraction from messy input.
- Add richer project dashboards and priority views.
- Explore Wiki graph insights and knowledge-gap detection.

Read the full [roadmap](./docs/ROADMAP.md).

## Limitations And Maturity

- This is not a hosted SaaS product.
- This is not a multi-tenant organization system.
- Built-in auth is token based; public deployments should sit behind an
  authenticated reverse proxy.
- Runtime data is not encrypted by the app itself.
- Agents cannot bypass review by design, but bad submissions still require
  human or reviewer-agent judgment.
- The first-run demo is intentionally fake and small.

## Project Status

This is an early public release. It is useful for builders who want to study or
adapt a local-first agent workbench, but it is not a hosted SaaS product and it
does not include your private knowledge base. Treat it as an engine, not as a
cloud service.

## Contributing

Contributions are welcome if they keep the same boundary:

- do not add real private data;
- keep local-first defaults safe;
- document API behavior when changing agent-facing routes;
- add or update tests for execution-state changes.

Start with [CONTRIBUTING.md](./CONTRIBUTING.md).
