# Personal OS

Personal OS is a private workbench for a Hermes-style agent. It turns Telegram,
file, link, voice transcript, and manual inputs into traceable work objects:
Inbox, Ideas, Today tasks, Projects, project records, activity history, and Telegram
reply payloads.

Personal Wiki remains the durable knowledge system. Personal OS does not replace
the Markdown vault; it links tasks and projects to Wiki notes so Hermes can read
the right context before doing work.

For the full product picture, read the repository-level docs:

- [Project README](../README.md)
- [Architecture](../docs/ARCHITECTURE.md)
- [Agent guide](../docs/AGENT_GUIDE.md)
- [Repository strategy](../docs/REPOSITORY_STRATEGY.md)

## What Runs Where

- Personal OS: web workbench and API, default local port `3000`, production port
  `3100` in `docker-compose.prod.yml`.
- Postgres: task/project/inbox/activity state.
- Personal Wiki: Markdown vault, search, tags, concepts, graph, default port
  `3422`.
- Hermes: the intelligent operator. It calls Personal OS and Personal Wiki APIs.

## Local Development

```bash
cp .env.example .env
docker compose up -d postgres
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000`.

## Production

Production writes require a real token. Do not deploy with `change-me`.

```bash
cp .env.prod.example .env
# edit PERSONAL_OS_API_TOKEN, PERSONAL_OS_READ_TOKEN, WIKI_READ_TOKEN,
# WIKI_API_TOKEN, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_WIKI_URL
docker compose -f docker-compose.prod.yml up -d --build
```

The production container runs `prisma migrate deploy` before starting Next.js.
The production compose file binds the web app to `127.0.0.1:3100` by default.
If you expose it to LAN or the Internet, put it behind an authenticated reverse
proxy first; the browser UI is a local-first control surface, not a public
multi-user app.

If you are upgrading an older prototype database that already has tables but no
Prisma migration history, mark the baseline migration as applied once, then run
deploy:

```bash
npx prisma migrate resolve --applied 20260422000100_init
npm run prisma:deploy
```

## Hermes Main Entry

Use one intake endpoint for normal operation:

```http
POST /api/intake
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
Content-Type: application/json
```

The intake endpoint creates the Inbox item, Agent run, optional Wiki notes,
ideas, tasks, project events, task-to-Wiki links, and Telegram reply payload.

Hermes should still call this before executing a task:

```http
GET /api/agent/context?taskId=<task_id>
```

That returns task fields, related project state, related ideas, explicit Wiki
links, candidate Wiki notes, recent task history, activity, and execution policy.

## Multi-Agent Task Bench

Personal OS is the shared source of truth for work state. Any authorized agent
runtime can poll the same backlog from a laptop, server, or scheduled worker.
The coordination rule is the task lease:

- tasks must be `executionMode=agent_allowed`;
- the agent profile must be enabled and match the task tags and risk level;
- a claim writes `status=doing`, `ownerAgent`, `leaseUntil`, and
  `lastHeartbeatAt`;
- heartbeats extend the lease while work continues;
- contributions and submissions are rejected if the agent no longer owns an
  active lease;
- when a lease expires, another matching agent may claim the task.

For cron-style workers that wake up every 30 minutes, prefer the auto-claim
entrypoint:

```http
POST /api/agent-inbox/claim-next
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
Content-Type: application/json

{
  "agentId": "knowledge-curator",
  "tags": ["wiki", "curation"],
  "limit": 10,
  "leaseMinutes": 90
}
```

If a task is claimed, the response includes `claimed: true`, the claimed task,
and the claim record. If no eligible task is available, the response is
`claimed: false` with `task: null`.

Use `agentTags` to route work to a class of agents, and use the `AgentProfile`
record to bind a concrete machine or runtime to the tags, risk level, and write
permissions it is allowed to use. Machine placement is therefore a deployment
choice: run a worker with a specific `agentId` and profile tags on the machine
that should pick up those tasks.

For proactive Telegram reminders, schedule Hermes or OpenClaw to call:

```http
GET /api/reminders/today?mode=morning
GET /api/reminders/today?mode=checkin
GET /api/reminders/today?mode=evening
Authorization: Bearer <PERSONAL_OS_READ_TOKEN>
```

The response contains `reminder.shouldSend` plus a ready-to-send Telegram
`payload.text` and `payload.buttons`.

For actual daily planning, use the richer planner packet:

```http
GET /api/planner/today?mode=morning
Authorization: Bearer <PERSONAL_OS_READ_TOKEN>
```

That returns tasks, ideas, projects, recent activity, Wiki candidates, and a
planner instruction for Hermes to turn into a short Telegram plan.

## Required Environment

- `DATABASE_URL`: Postgres connection string.
- `PERSONAL_OS_API_TOKEN`: required for production writes.
- `PERSONAL_OS_READ_TOKEN`: required for production read APIs used by agents.
- `WIKI_READ_TOKEN`: token used when Personal OS reads Personal Wiki.
- `WIKI_API_TOKEN`: token used when `/api/intake` writes to Personal Wiki.
- `NEXT_PUBLIC_APP_URL`: browser-visible Personal OS URL.
- `NEXT_PUBLIC_WIKI_URL`: browser-visible Personal Wiki URL.
- `PERSONAL_OS_VAULT_DIR`: local project-record Markdown path.
- `PERSONAL_OS_ATTACHMENT_DIR`: future attachment path.

## Verification

```bash
npm run prisma:generate
npm test
npm audit --omit=dev --audit-level=moderate
npm run lint
npm run build
```

`scripts/smoke-hermes-flow.ps1` is for a real running service and writes data.
Use it against a disposable or internal test stack, not production data.
