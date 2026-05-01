# Getting Started

This guide runs the public demo locally and shows the loop this project is
built around:

```text
capture -> wiki memory -> task -> agent claim -> evidence -> review
```

The demo uses fake seed data only. Do not put real vaults, private server
inventories, tokens, or task history into Git.

## Fastest Path

If you only want to see the product loop, run the root demo:

```bash
git clone https://github.com/lawyer112/personal-os-wiki.git
cd personal-os-wiki
sh ./scripts/demo.sh
```

On Windows PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo.ps1
```

Both helper scripts run the same underlying Docker Compose stack:

```bash
docker compose up -d --build
```

Open:

```text
Personal OS:   http://localhost:3000/auth/read
Read token:    demo-read-token

Personal Wiki: http://localhost:3422/auth/read
Read token:    demo-wiki-read-token
```

This path starts Postgres, Personal Wiki, Personal OS, and fake seed data.
If you are wondering why there are two browser URLs, read
[Service Topology](./SERVICE_TOPOLOGY.md). The short answer: this is one product
stack, but it runs Personal OS and Personal Wiki as separate web services.

## Prerequisites

- Git
- Docker and Docker Compose
- Node.js 24 or newer only for local app development
- npm only for local app development
- Python 3.11 or newer only for running Personal Wiki without Docker

For host sizing, ports, production-style compose, reverse proxy guidance, and
backup requirements, read the [Deployment Guide](./DEPLOYMENT.md).

## 1. Clone The Repository

```bash
git clone https://github.com/lawyer112/personal-os-wiki.git
cd personal-os-wiki
```

## 2. Start Personal Wiki Manually

```bash
cd personal-wiki
cp .env.example .env
docker compose up -d --build
```

Open:

```text
http://localhost:3422
```

The default `.env.example` enables read authentication and write
authentication. Before exposing this service beyond your own machine, replace
the placeholder tokens with long random values.

## 3. Start Personal OS Manually

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

For Wiki integration, set `WIKI_API_TOKEN` and `WIKI_READ_TOKEN` in
`personal-os-app/.env` to match `personal-wiki/.env`.

## 4. What You Should See

After `npm run prisma:seed`, the app contains fictional demo data:

| Surface | Demo item |
| --- | --- |
| Projects | `Acorn Launch Lab` |
| Inbox | `Demo input: collect three customer notes...` |
| Tasks | `Review the fictional launch checklist` |
| Ideas | `Add a demo screenshot after UI polish` |
| Notes | `Demo launch checklist` |
| Activity | `demo.seeded` and task contribution events |

Suggested click path:

1. Open `Today` to see what the app treats as current work.
2. Open `Capture`, save one test link, then open `Inbox` and confirm it is only
   recorded as a new input.
3. Open `Tasks` and click `Review the fictional launch checklist`.
4. Check the next action, definition of done, Wiki link, contribution, and
   artifact.
5. Open `Projects` and inspect `Acorn Launch Lab`.
6. Open `Ideas` and confirm the screenshot idea stayed as an idea instead of
   becoming a fake task.
7. Open the Wiki service and ingest or browse Markdown notes separately.

## 5. Minimal API Smoke Test

For the root one-command demo, use the embedded demo tokens:

```bash
curl -H "Authorization: Bearer demo-read-token" \
  http://localhost:3000/api/today
```

For manual dev or production-like installs, use the values from
`personal-os-app/.env`. Dev mode normally runs on port `3000`; production
compose runs on port `3100`.

```bash
curl -H "Authorization: Bearer <PERSONAL_OS_READ_TOKEN>" \
  http://localhost:3000/api/today
```

Production compose variant:

```bash
curl -H "Authorization: Bearer <PERSONAL_OS_READ_TOKEN>" \
  http://localhost:3100/api/today
```

Capture a small input:

```bash
curl -X POST http://localhost:3000/api/intake \
  -H "Authorization: Bearer <PERSONAL_OS_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "sourceType": "manual",
      "sourcePlatform": "demo",
      "rawText": "Demo input: compare the agent queue with my current workflow.",
      "createdBy": "user"
    },
    "agent": {
      "model": "example-agent-model",
      "reasoningSummary": "Classified demo input as one follow-up task."
    },
    "tasks": [
      {
        "title": "Compare the demo agent queue with my workflow",
        "status": "todo",
        "priority": "P2",
        "agentTags": ["demo", "review"],
        "nextAction": "Write one paragraph with the biggest gap.",
        "definitionOfDone": "A review note is attached to the task."
      }
    ]
  }'
```

Poll work for an agent:

```bash
curl -H "Authorization: Bearer <PERSONAL_OS_API_TOKEN>" \
  "http://localhost:3000/api/agent-inbox?agentId=demo-agent&tags=demo,review"
```

Load context for a task:

```bash
curl -H "Authorization: Bearer <PERSONAL_OS_READ_TOKEN>" \
  "http://localhost:3000/api/agent/context?taskId=<task-id>"
```

## 6. Endpoint Cheat Sheet

| Purpose | Endpoint | Token |
| --- | --- | --- |
| Read today workspace | `GET /api/today` | read token in production |
| Save passive web capture | `GET /capture` | private app session / local access |
| Capture mixed input | `POST /api/intake` | `PERSONAL_OS_API_TOKEN` |
| Agent polls work | `GET /api/agent-inbox` | `PERSONAL_OS_API_TOKEN` |
| Agent loads context | `GET /api/agent/context?taskId=...` | `PERSONAL_OS_READ_TOKEN` |
| Agent claims work | `POST /api/tasks/:id/claim` | `PERSONAL_OS_API_TOKEN` |
| Agent heartbeats | `POST /api/tasks/:id/heartbeat` | `PERSONAL_OS_API_TOKEN` |
| Agent submits work | `POST /api/tasks/:id/submit` | `PERSONAL_OS_API_TOKEN` |
| Wiki ingest | `POST /api/ingest` | `WIKI_API_TOKEN` |

The complete agent protocol is documented in
[`AGENT_GUIDE.md`](./AGENT_GUIDE.md) and
[`../personal-os-app/docs/HERMES_API.md`](../personal-os-app/docs/HERMES_API.md).

## 7. First-Run Troubleshooting

### Prisma client is missing

Run:

```bash
npm run prisma:generate
```

### PostgreSQL connection fails

Make sure the password in `personal-os-app/.env` matches the password used by
the local compose service. The example config uses port `54329`.

### Wiki opens but asks for auth

That is expected when read auth is enabled. Use `WIKI_READ_TOKEN` from
`personal-wiki/.env`, or open it through the Personal OS handoff route if you
configured both services.

### Do not see the demo project

Run:

```bash
npm run prisma:seed
```

The seed command resets demo tables and recreates the fictional project,
task, note, idea, contribution, artifact, and activity records.
