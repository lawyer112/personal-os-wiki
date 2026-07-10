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

Production reads and writes require real tokens by default. On a trusted private
network, set `PERSONAL_OS_AUTH_DISABLED=true` to disable Personal OS API/page
auth explicitly.

```bash
cp .env.prod.example .env
# edit PERSONAL_OS_API_TOKEN, PERSONAL_OS_READ_TOKEN, PERSONAL_OS_AUTH_DISABLED,
# WIKI_READ_TOKEN, WIKI_API_TOKEN, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_WIKI_URL
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
- `PERSONAL_OS_API_TOKEN`: required for production writes unless `PERSONAL_OS_AUTH_DISABLED=true`.
- `PERSONAL_OS_READ_TOKEN`: required for production read APIs used by agents unless `PERSONAL_OS_AUTH_DISABLED=true`.
- `PERSONAL_OS_AUTH_DISABLED`: set to `true` only on a trusted private network to disable Personal OS API/page auth.
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
