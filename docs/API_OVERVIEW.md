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

Record a passive browser capture without spending LLM tokens:

```text
Open http://localhost:3000/capture
```

Paste or drop one raw link. The capture page writes one `InboxItem(status=new)`.
Agent timing is external policy: process it immediately, batch it, run daily, or
only process on explicit request.

Capture mixed input through an active agent:

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
        "executionMode": "agent_allowed",
        "agentTags": ["demo", "review"],
        "nextAction": "Write one paragraph with the biggest gap.",
        "definitionOfDone": "A review note is attached to the task."
      }
    ]
  }'
```

Register or update an agent profile before letting that agent poll work:

```bash
curl -X POST http://localhost:3000/api/agent-profiles \
  -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "demo-agent",
    "displayName": "Demo Agent",
    "tags": ["demo", "review"],
    "capabilities": ["read_context", "write_contribution", "submit_review"],
    "allowedRiskLevel": "low",
    "canWriteTasks": true,
    "enabled": true
  }'
```

Poll work for an agent:

```bash
curl -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  "http://localhost:3000/api/agent-inbox?agentId=demo-agent&tags=demo,review"
```

For scheduled workers, let Personal OS select and claim the next eligible task
in one request:

```bash
curl -X POST http://localhost:3000/api/agent-inbox/claim-next \
  -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "demo-agent",
    "tags": ["demo", "review"],
    "limit": 10,
    "leaseMinutes": 30
  }'
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

Save the planner output that was actually delivered to the user:

```bash
curl -X POST http://localhost:3000/api/planner/today \
  -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "morning",
    "timezone": "Asia/Shanghai",
    "mainLine": "Ship the demo agent review loop.",
    "firstAction": "Run the focused test suite and attach the result.",
    "blocked": [],
    "needsDecision": ["Choose whether this task should be public-facing."],
    "deliveredTo": ["telegram"]
  }'
```

## Endpoint Matrix

| Purpose | Endpoint | Method | Token |
| --- | --- | --- | --- |
| Read Today workspace | `/api/today` | `GET` | `PERSONAL_OS_READ_TOKEN` |
| Read planner packet | `/api/planner/today?mode=...` | `GET` | `PERSONAL_OS_READ_TOKEN` |
| Save planner snapshot | `/api/planner/today` | `POST` | `PERSONAL_OS_API_TOKEN` |
| Read planner snapshots | `/api/planner/snapshots` | `GET` | `PERSONAL_OS_READ_TOKEN` |
| Read reminder payload | `/api/reminders/today?mode=...` | `GET` | `PERSONAL_OS_READ_TOKEN` |
| Browser capture form | `/capture` | `GET/POST form action` | private app session / local access |
| Capture mixed input | `/api/intake` | `POST` | `PERSONAL_OS_API_TOKEN` |
| Create raw Inbox item | `/api/inbox/items` | `POST` | `PERSONAL_OS_API_TOKEN` |
| Register agent profile | `/api/agent-profiles` | `GET/POST` | read for GET, write for POST |
| Agent polls work | `/api/agent-inbox` | `GET` | `PERSONAL_OS_API_TOKEN` |
| Agent claims next eligible work | `/api/agent-inbox/claim-next` | `POST` | `PERSONAL_OS_API_TOKEN` |
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

- Register an `AgentProfile` before polling work.
- `AgentProfile.capabilities` is metadata for humans and future schedulers; the
  current hard checks are enabled state, task-write permission, tags, and risk.
- Only tasks with `executionMode=agent_allowed` and non-high risk can be claimed.
- Heartbeat, contribution, and submit re-check the same task policy and agent
  profile. If a human changes the task to `approval_required` or disables the
  profile, the active lease can no longer mutate the task.
- Claim before working.
- Use `/api/agent-inbox/claim-next` for cron-style workers that should pick one
  task and immediately lease it. Use `/api/agent-inbox` plus
  `/api/tasks/:id/claim` when the worker needs to inspect or rank candidates
  itself.
- Keep the lease alive with heartbeat if work takes time.
- Do not contribute or submit after the lease expires; claim again first.
- Attach evidence and artifact URLs.
- Submit for review instead of silently marking work done.
- Let a human or reviewer agent approve, reject, block, or archive.

This is intentionally stricter than a chat workflow. It makes agent work
auditable and resumable.
