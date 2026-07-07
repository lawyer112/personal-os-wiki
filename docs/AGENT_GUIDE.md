# Agent Guide

This document is the operating manual for any agent that uses Personal OS and
Personal Wiki. The agent can be Hermes, Codex, OpenClaw, a scheduled worker, or
a model running behind an OpenAI-compatible API. The product contract is the
same.

If you need a copyable system/developer prompt, start with
[Agent Prompt Template](./AGENT_PROMPT.md), then use this guide as the detailed
protocol reference.

## Prime Directive

Do not merely summarize. Convert useful input into durable knowledge, concrete
tasks, and reviewable outputs.

The system exists to reduce drift and increase real progress. If an agent writes
vague tasks, it has failed the user even if the API call succeeds.

## Required Environment

Agents need runtime configuration, not hard-coded secrets:

```bash
PERSONAL_OS_BASE_URL=http://localhost:3000
PERSONAL_OS_API_TOKEN=replace-with-runtime-token
PERSONAL_OS_READ_TOKEN=replace-with-runtime-token
PERSONAL_WIKI_BASE_URL=http://localhost:3422
WIKI_API_TOKEN=replace-with-runtime-token
WIKI_READ_TOKEN=replace-with-runtime-token
```

Rules:

- Do not put tokens in URLs.
- Do not commit env files.
- Do not paste real tokens into Wiki notes or task comments.
- If a write returns `401`, report token/config failure instead of pretending
  the task is done.

## Read This Before Acting

1. Check whether the user asked for discussion only. If yes, do not write.
2. If the user gives an input that sounds like a project, task, link, source, or
   durable idea, use Personal OS intake.
3. If the input contains long-term knowledge, write or update Personal Wiki.
4. If the input contains work, create or update a task.
5. If the work is uncertain, create the task in `review`.
6. If an action is destructive, requires credentials, or changes deployment
   state, require review.

## Input Routing

| Input | Personal OS | Personal Wiki | Notes |
| --- | --- | --- | --- |
| Raw rambling idea | Inbox + Idea | Optional summary note | Keep the original trace. |
| Link or article | Inbox + maybe Task | Markdown source note | Extract why it matters, not only the title. |
| Project direction | ProjectEvent + Task | Project note | Connect to current project state. |
| Server observation | Task or ProjectEvent | Evidence note | Never store secrets. |
| Daily planning | Today tasks | Optional reflection note | Produce concrete next actions. |
| Agent output | Contribution + Review | Artifact or updated note | Include evidence and what changed. |

## Good Task Shape

Every task should have:

- `title`: short, action-oriented.
- `nextAction`: the next physical or digital action.
- `definitionOfDone`: how a reviewer knows it is complete.
- `priority`: P0/P1/P2/P3.
- `agentTags`: which agents should see it.
- `riskLevel`: `low`, `medium`, or `high`.
- `executionMode`: `manual`, `agent_suggested`, `agent_allowed`,
  `approval_required`, or `blocked_until_user`.
- `requiredOutput`: what artifact must be produced.

Bad:

```text
整理 Wiki
优化项目
研究一下这个方向
推进一下重要项目
```

Good:

```text
Create missing project notes for the three orphan Wiki concepts and link them
from the fictional demo project index. Done when each note has goal, current
status, next action, related tasks, and evidence links.
```

## Task Claiming Protocol

Agents should not race each other. Use the lease protocol.

```text
poll -> claim -> context -> execute -> heartbeat -> contribute -> submit -> review
```

Multiple machines can run the same worker loop. The worker identity is the
`agentId`; the placement policy is the `AgentProfile` plus task `agentTags`.
For example, a Mac mini can run `mac-curator` with `["wiki", "mac"]`, while a
Linux server runs `research-worker` with `["wiki", "research"]`. Both can poll
the same Personal OS. A successful claim writes `ownerAgent`, `leaseUntil`,
`lastHeartbeatAt`, and `status=doing`, which keeps other agents from taking the
same task until the lease expires.

Before polling, the operator must register an `AgentProfile` with matching tags
and permissions. The task worker can claim only tasks that satisfy all of these
conditions:

- task status is `todo`, or an expired `doing` lease is available;
- task `executionMode` is `agent_allowed`;
- task `riskLevel` is not `high`;
- the agent profile is enabled and `canWriteTasks=true`;
- the task tags are empty or overlap with the agent profile tags;
- the task risk is within the agent profile `allowedRiskLevel`.

The same policy is re-checked on heartbeat, contribution, and submit. A task or
profile policy change after claim stops further mutation even if the old lease
has not expired.

`AgentProfile.capabilities` is currently descriptive metadata. Do not assume it
blocks browser, file, or shell access by itself; tool-level permissions still
belong to the worker runtime.

If any condition fails, the agent should write a clarification or ask for review
instead of trying to bypass the queue.

### Poll

```http
GET /api/agent-inbox?agent_id=knowledge-curator&tags=wiki,curation&limit=10
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
```

Use this when the worker needs to inspect or rank candidate tasks before
claiming one.

### Auto-Claim Next

```http
POST /api/agent-inbox/claim-next
Authorization: Bearer <PERSONAL_OS_API_TOKEN>

{
  "agentId": "knowledge-curator",
  "tags": ["wiki", "curation"],
  "limit": 10,
  "leaseMinutes": 90
}
```

Use this for cron-style workers that wake up on an interval, such as every 30
minutes. Personal OS lists eligible tasks for that agent, attempts to claim the
first one, and skips to the next candidate if another agent won the lease race.
When no work is available, the response returns `claimed: false`.

### Claim

```http
POST /api/tasks/<task_id>/claim
Authorization: Bearer <PERSONAL_OS_API_TOKEN>

{
  "agentId": "knowledge-curator",
  "leaseMinutes": 90
}
```

### Load Context

```http
GET /api/agent/context?taskId=<task_id>
Authorization: Bearer <PERSONAL_OS_READ_TOKEN>
```

Use this context packet first. Do not scrape the whole vault unless the context
packet is insufficient and the task requires deeper research.

### Heartbeat

```http
POST /api/tasks/<task_id>/heartbeat
Authorization: Bearer <PERSONAL_OS_API_TOKEN>

{
  "agentId": "knowledge-curator",
  "leaseMinutes": 90
}
```

### Contribute

```http
POST /api/tasks/<task_id>/contributions
Authorization: Bearer <PERSONAL_OS_API_TOKEN>

{
  "agentId": "knowledge-curator",
  "summary": "Updated the project index and linked three missing project notes.",
  "evidenceLinks": ["wiki://project_index"],
  "artifactUrls": ["http://localhost:3422/notes"],
  "nextRecommendation": "Ask a reviewer agent to check for remaining orphan concepts."
}
```

### Submit

```http
POST /api/tasks/<task_id>/submit
Authorization: Bearer <PERSONAL_OS_API_TOKEN>

{
  "agentId": "knowledge-curator",
  "summary": "The task is complete. Evidence and artifacts are attached.",
  "artifactUrls": ["wiki://project_index"],
  "definitionOfDoneMet": true,
  "needsHumanDecision": false
}
```

Agents submit. Reviewers approve. The worker should not mark its own work done
unless the system explicitly allows that policy.

## Notification Adapter Agents

Some agents do not execute tasks. They deliver nudges to real user surfaces such
as Telegram, Feishu, Apple Reminders on a Mac, email, or desktop notifications.

Adapter agents must follow this boundary:

- Read `/api/reminders/today` or `/api/planner/today`.
- Deliver the returned payload to the configured surface.
- Deduplicate messages or reminders using stable markers.
- Do not mark tasks done from notification delivery or reminder completion.
- Do not create tasks from notification text unless the user explicitly asks.
- Report missing or duplicated destination lists/channels instead of guessing.

For Apple Reminders and Mac-specific behavior, see
[`MAC_AGENT_ADAPTER.md`](./MAC_AGENT_ADAPTER.md).

## Writing Wiki Notes

Wiki notes should be useful to both humans and agents.

Minimum useful structure:

```markdown
# Title

## Summary

What this means in plain language.

## Current State

What is true now and how we know.

## Evidence

- Source or command output summary.
- Related task or project link.

## Next Actions

- Concrete action, owner, and expected output.

## Links

- [[Related Concept]]
- [[Related Project]]
```

Rules:

- Do not store passwords, tokens, cookies, private keys, or secret URLs.
- Prefer evidence over confidence theater.
- Link tasks to notes and notes to tasks.
- Mark stale or uncertain facts instead of silently treating them as current.

## Writing User-Facing Notifications

Notifications should be short and actionable.

Use this shape:

```text
Today's main line:
Do first:
Blocked:
Needs your decision:
Can wait:
Smallest next step:
```

Avoid abstract phrasing:

- "optimize the project"
- "organize into a topic page"
- "push the main line"

Use concrete phrasing:

- "Run the local demo and paste the error into the task."
- "Create the missing README section and link it from the root README."
- "Choose one of the two deployment options so the agent can continue."

## Failure Handling

- `401`: token/config problem. Stop and report the missing credential boundary.
- `400`: payload shape problem. Fix the request body.
- `404`: stale task/note/project reference. Refresh context.
- Wiki unavailable: do not conclude knowledge is absent. Mark context as partial.
- Lease expired: re-claim before writing contributions.
- Destructive action needed: submit a review request instead of executing.

## Review Etiquette

Agent outputs must include:

- what changed
- where it changed
- how it was verified
- what remains risky or uncertain
- whether human approval is needed

The goal is not to sound busy. The goal is to make progress auditable.
