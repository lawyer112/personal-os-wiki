# API Overview

This document is the short, copyable API map. The full Hermes-style contract is
in [`../personal-os-app/docs/HERMES_API.md`](../personal-os-app/docs/HERMES_API.md).

## Authentication

Personal OS uses bearer tokens.

| Token | Used for |
| --- | --- |
| `PERSONAL_OS_API_TOKEN` | Mutating routes and agent execution routes. |
| `PERSONAL_OS_READ_TOKEN` | Read-only context and workspace routes. |

Personal Wiki uses separate read and write tokens.

| Token | Used for |
| --- | --- |
| `WIKI_API_TOKEN` | Writing notes through ingest/update APIs. |
| `WIKI_READ_TOKEN` | Reading private Wiki pages and APIs. |

Do not put write tokens in browser URLs, screenshots, logs, or public docs.

## Minimal Personal OS Calls

Read the Today workspace:

```bash
curl -H "Authorization: Bearer $PERSONAL_OS_READ_TOKEN" \
  http://localhost:3000/api/today
```

Capture mixed input:

```bash
curl -X POST http://localhost:3000/api/intake \
  -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
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
        "riskLevel": "low",
        "agentTags": ["demo", "review"],
        "nextAction": "Write one paragraph with the biggest gap.",
        "definitionOfDone": "A review note is attached to the task."
      }
    ]
  }'
```

Poll work for an agent:

```bash
curl -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  "http://localhost:3000/api/agent-inbox?agentId=demo-agent&tags=demo,review"
```

Claim a task:

```bash
curl -X POST \
  -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"demo-agent","leaseMinutes":30}' \
  "http://localhost:3000/api/tasks/<task-id>/claim"
```

Load context for a task:

```bash
curl -H "Authorization: Bearer $PERSONAL_OS_READ_TOKEN" \
  "http://localhost:3000/api/agent/context?taskId=<task-id>"
```

Submit evidence:

```bash
curl -X POST \
  -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "demo-agent",
    "summary": "Compared the queue with the workflow and attached findings.",
    "artifactUrls": ["https://example.com/demo-artifact"],
    "evidenceLinks": ["wiki://demo/demo-launch-checklist.md"],
    "definitionOfDoneMet": true,
    "needsHumanDecision": true
  }' \
  "http://localhost:3000/api/tasks/<task-id>/submit"
```

## Endpoint Matrix

| Purpose | Endpoint | Method | Token |
| --- | --- | --- | --- |
| Read Today workspace | `/api/today` | `GET` | `PERSONAL_OS_READ_TOKEN` |
| Read planner packet | `/api/planner/today?mode=...` | `GET` | `PERSONAL_OS_READ_TOKEN` |
| Read reminder payload | `/api/reminders/today?mode=...` | `GET` | `PERSONAL_OS_READ_TOKEN` |
| Capture mixed input | `/api/intake` | `POST` | `PERSONAL_OS_API_TOKEN` |
| Agent polls work | `/api/agent-inbox` | `GET` | `PERSONAL_OS_API_TOKEN` |
| Agent loads context | `/api/agent/context?taskId=...` | `GET` | `PERSONAL_OS_READ_TOKEN` |
| Agent claims work | `/api/tasks/:id/claim` | `POST` | `PERSONAL_OS_API_TOKEN` |
| Agent heartbeats | `/api/tasks/:id/heartbeat` | `POST` | `PERSONAL_OS_API_TOKEN` |
| Agent contributes progress | `/api/tasks/:id/contributions` | `POST` | `PERSONAL_OS_API_TOKEN` |
| Agent submits work | `/api/tasks/:id/submit` | `POST` | `PERSONAL_OS_API_TOKEN` |
| Reviewer decides | `/api/tasks/:id/review` | `POST` | `PERSONAL_OS_API_TOKEN` |
| Wiki ingest | `Personal Wiki /api/ingest` | `POST` | `WIKI_API_TOKEN` |

## Response Shape

Most JSON APIs return:

```json
{
  "ok": true
}
```

Errors use:

```json
{
  "ok": false,
  "error": "Missing or invalid API token"
}
```

Validation errors include an `issues` array.

## Agent State Contract

Agents should treat the Personal OS task record as the source of truth:

- Claim before working.
- Keep the lease alive with heartbeat if work takes time.
- Attach evidence and artifact URLs.
- Submit for review instead of silently marking work done.
- Let a human or reviewer agent approve, reject, block, or archive.

This is intentionally stricter than a chat workflow. It makes agent work
auditable and resumable.
