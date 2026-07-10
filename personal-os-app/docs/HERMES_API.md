# Hermes Integration Contract

Personal OS is the source of truth for work state: inbox, tasks, projects,
activity log, and Telegram notification payloads. Personal Wiki is the source
of truth for durable knowledge: Markdown vault, search, tags, concepts, and the
knowledge graph.

Default local base URL:

```text
http://localhost:3000
```

Server deployment base URL:

```text
Personal OS:   http://<server-host>:3100
Personal Wiki: http://<server-host>:3422
```

This repo includes `docker-compose.prod.yml` for a server deployment where
host port `3000` is already occupied.

Write authentication is required for production writes. Send:

```http
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
```

## Agent Runtime Environment

Personal OS does not push its write token into Hermes automatically. The agent
runtime must load the token and send it as the `Authorization` header on every
write request.

Set these variables in the agent runtime through your process manager, secret
store, or private deployment automation. Do not pass tokens through URLs.

```bash
export PERSONAL_OS_BASE_URL='http://127.0.0.1:3100'
export PERSONAL_OS_API_TOKEN='<personal-os-write-token>'
export PERSONAL_OS_READ_TOKEN='<personal-os-read-token>'
export PERSONAL_WIKI_BASE_URL='http://localhost:3422'
export WIKI_READ_TOKEN='<personal-wiki-read-token>'
```

If you use an env file for local testing, keep it outside Git and set mode
`0600`:

```bash
mkdir -p ~/.config/personal-os
chmod 700 ~/.config/personal-os
$EDITOR ~/.config/personal-os/agent.env
chmod 600 ~/.config/personal-os/agent.env
```

Failure interpretation:

- `401 Missing or invalid API token`: the agent did not send
  `Authorization: Bearer <PERSONAL_OS_API_TOKEN>`, or it loaded the wrong token.
- `400 Validation failed`: the token was accepted, but the request body is not a
  valid Inbox/Task payload.
- `201`: the write succeeded.

Do not send `source` as a string. The current intake contract requires an object with at least `source.sourceType` and `source.rawText`. When running from this repository, prefer `npm run agent:intake -- --base-url <url> --payload <file> --verify-query <query>` so validation failures report safe field paths and successful writes are read back.

## System Boundary

Do not treat Personal OS as the replacement for Personal Wiki.

```text
Personal OS 3100
- InboxItem: original Telegram/file/link/transcript intake trace
- Idea: captured thought that is not yet a task or durable note
- Task: today's actions, review queue, waiting, blocked, done
- ProjectEvent: project progress and decisions
- ActivityLog: audit trail and undo context
- Notification: payload for Hermes to push back to Telegram

Personal Wiki 3422
- Markdown vault
- readable long-term notes
- search, tags, concepts
- graph/topology/wiki browsing
- maintenance APIs for update/archive/delete/relink
```

`POST /api/notes` in Personal OS is only for project-local notes and processing
summaries. Durable knowledge, link summaries, file summaries, DeepTalk
transcripts, and handbook-style material should go to Personal Wiki
`POST /api/ingest`.

## Routing Rule

Hermes must route each input by intent:

| Input kind | Write target | Rule |
| --- | --- | --- |
| Raw idea or brainstorm | Personal OS `3100/api/intake` `ideas[]` | Capture it for quick triage: promote to task, keep shaping, someday, or archive. |
| Link, file, transcript, DeepTalk export, durable reference | Personal Wiki `3422/api/ingest` | Create a human-readable Markdown note with tags and concepts. |
| Action, task, waiting item, blocked item, project progress | Personal OS `3100/api/inbox/items` then `3100/api/tasks` or project event | Keep source trace in Inbox, then create execution objects. |
| Mixed input with knowledge and action | Both systems | Knowledge goes to Wiki; execution goes to Personal OS; Telegram summary mentions both. |
| Unclear action | Personal OS task with `status: "review"` | Let the user accept, rewrite, wait, or ignore from Today. |

## Default Flow

1. User sends Telegram text, link, file, transcript, or exported DeepTalk text.
2. Hermes classifies the material and prepares readable outputs.
3. Hermes calls Personal OS `POST /api/intake` once.
4. Personal OS creates the Inbox item, Agent run, ideas, tasks, project events, Wiki
   writes, task-to-Wiki links, activity records, and Telegram reply payload.
5. Hermes sends the returned Telegram payload back to the user.

## Intake

Use this for normal operation.

```http
POST /api/intake
Content-Type: application/json
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
```

```json
{
  "source": {
    "sourceType": "telegram",
    "sourcePlatform": "telegram",
    "sourceMessageId": "12345",
    "rawText": "把这个 DeepTalk 导出链路整理成任务和知识笔记",
    "attachments": []
  },
  "agent": {
    "model": "example-agent-model",
    "classification": { "kind": "mixed", "confidence": 0.92 },
    "reasoningSummary": "这条输入同时包含长期知识和一个待验证动作。"
  },
  "project": {
    "name": "Personal OS",
    "currentFocus": "跑通 Hermes 输入到任务和知识库的闭环"
  },
  "wikiNotes": [
    {
      "title": "DeepTalk 输入链路",
      "content": "# DeepTalk 输入链路\n\n结论：先走导出文件或 Telegram 转发。",
      "source_type": "voice-transcript",
      "tags": ["deeptalk", "input"],
      "metadata": { "source": "telegram" }
    }
  ],
  "tasks": [
    {
      "title": "验证 DeepTalk 导出链路",
      "status": "review",
      "priority": "P1",
      "nextAction": "拿一份真实转写结果，验证导出和转发路径。",
      "definitionOfDone": "形成可执行的 DeepTalk 输入方案。"
    }
  ],
  "ideas": [
    {
      "title": "DeepTalk 自动入库可以先走半自动路线",
      "body": "如果钉钉没有稳定 API，先把导出文本转发给 Telegram，再由 Hermes 统一整理。",
      "status": "captured",
      "priority": "P2",
      "tags": ["deeptalk", "input"]
    }
  ],
  "notification": {
    "recipient": "telegram-user-id"
  }
}
```

The response includes the created Inbox item, Agent run id, ideas, tasks, Wiki write
results, project events, and optional Telegram payload with direct object links.

Use `taskProposals` for actions extracted from incomplete or ambiguous input. They are stored as `review` + `agent_suggested`. Automatic promotion requires explicit `autoPromote: true`, low risk, an estimate no greater than 120 minutes, and at least one agent tag.

## Structured Hybrid Recall

Use keyword GET for discovery and POST when scope or exact prior evidence matters:

```http
POST /api/agent/context
Authorization: Bearer <PERSONAL_OS_READ_TOKEN>

{
  "query": "继续外置记忆召回评测",
  "scope": { "projectName": "Personal OS", "sourceType": "agent-output" },
  "required_refs": [
    {
      "memory_id": "wiki:vault/example-memory.md",
      "version": 1,
      "chunk_id": "结论"
    }
  ],
  "top_k": 8,
  "budget": { "tokens": 1800 }
}
```

Required refs are exact and fail closed with `422` for missing, retracted, superseded, version-mismatched, or missing-heading evidence. The response includes `queryPlan` and `requiredRefs` for retrieval auditing.

The lower-level endpoints below are still available for maintenance, testing, or
manual recovery.

## Create Inbox Item

```http
POST /api/inbox/items
Content-Type: application/json
```

```json
{
  "sourceType": "telegram",
  "sourcePlatform": "telegram",
  "sourceMessageId": "12345",
  "rawText": "把这个链接整理成任务和笔记",
  "sourceUrl": "https://example.com",
  "attachments": [],
  "createdBy": "user"
}
```

Response:

```json
{
  "ok": true,
  "item": {
    "id": "..."
  }
}
```

## Start Agent Run

```http
POST /api/agent/runs
Content-Type: application/json
```

```json
{
  "inboxItemId": "<inbox_id>",
  "model": "example-agent-model",
  "classification": {
    "kind": "work_update",
    "confidence": 0.92
  },
  "reasoningSummary": "用户想把输入变成可执行任务和可读笔记。"
}
```

## Create Task

Tasks must be execution objects, not note snippets.

```http
POST /api/tasks
Content-Type: application/json
```

```json
{
  "title": "确认 DeepTalk 导出链路",
  "status": "review",
  "priority": "P1",
  "nextAction": "拿一份真实 DeepTalk 转写文件，验证能否由 Telegram 或手动导出进入 Personal OS。",
  "definitionOfDone": "Inbox、AgentRun、Task、Note 和通知 payload 都能追溯到同一份来源。",
  "sourceInboxItemId": "<inbox_id>",
  "sourceAgentRunId": "<run_id>",
  "createdBy": "hermes"
}
```

Allowed task statuses:

```text
review, todo, doing, waiting, blocked, done, archived
```

Allowed priorities:

```text
P0, P1, P2, P3
```

## Create Or Process Idea

Ideas are buffer objects. Use them when the user says something valuable but it
is not yet a clear task or a durable knowledge note.

```http
POST /api/ideas
Content-Type: application/json
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
```

```json
{
  "title": "DeepTalk 自动入库先走半自动路线",
  "body": "如果钉钉没有稳定 API，先把导出文本转发给 Telegram，再由 Hermes 统一整理。",
  "status": "captured",
  "priority": "P2",
  "tags": ["deeptalk", "input"],
  "nextAction": "拿一条真实转写测试 Telegram 转发路径。",
  "sourceInboxItemId": "<inbox_id>",
  "sourceAgentRunId": "<run_id>"
}
```

Useful maintenance calls:

```http
PATCH /api/ideas/<idea_id>
POST /api/ideas/<idea_id>/promote
```

Allowed idea statuses:

```text
captured, shaping, someday, promoted, archived
```

## Create Project Note

Project notes are not the main wiki. Use this only for Personal OS-local
processing summaries, project context, or a short note that should stay attached
to a project.

```http
POST /api/notes
Content-Type: application/json
```

```json
{
  "title": "DeepTalk 输入链路",
  "body": "# DeepTalk 输入链路\n\n结论：如果钉钉没有开放 API，先走导出文件或转发文本进入 Telegram。\n",
  "tags": ["deeptalk", "input", "personal-os"],
  "concepts": ["语音转文字", "Agent 入库"],
  "projectIds": ["<project_id>"],
  "sourceInboxItemId": "<inbox_id>",
  "sourceAgentRunId": "<run_id>"
}
```

For real knowledge-base ingestion, use Personal Wiki:

```http
POST http://<server-host>:3422/api/ingest
Authorization: Bearer <WIKI_API_TOKEN>
Content-Type: application/json
```

```json
{
  "title": "DeepTalk 输入链路",
  "content": "# DeepTalk 输入链路\n\n结论：如果钉钉没有开放 API，先走导出文件或转发文本进入 Telegram。\n\n相关概念：[[语音转文字]] [[Agent 入库]]\n",
  "source_type": "voice-transcript",
  "source_url": "",
  "tags": ["deeptalk", "input", "personal-wiki"],
  "metadata": {
    "intake": "telegram",
    "personal_os_inbox_id": "<inbox_id>",
    "personal_os_agent_run_id": "<run_id>"
  }
}
```

## Complete Agent Run

```http
POST /api/agent/runs/<run_id>/complete
Content-Type: application/json
```

```json
{
  "classification": {
    "kind": "work_update",
    "confidence": 0.92
  },
  "reasoningSummary": "这条输入同时包含一个待验证任务和一篇知识笔记。",
  "outputSummary": "创建 1 个任务和 1 篇笔记。"
}
```

## Create Telegram Notification Payload

Personal OS does not send Telegram messages in the MVP. It returns a payload;
Hermes sends it.

```http
POST /api/notifications/telegram
Content-Type: application/json
```

```json
{
  "recipient": "telegram-user-id",
  "projectName": "Personal OS",
  "notes": [{ "id": "note_1", "title": "DeepTalk 输入链路" }],
  "tasks": [{ "id": "task_1", "title": "确认 DeepTalk 导出链路", "status": "review" }],
  "appUrl": "http://localhost:3000"
}
```

Response includes:

```json
{
  "payload": {
    "text": "已处理：生成 1 篇笔记，生成 1 个任务，归入 Personal OS。",
    "buttons": [
      { "label": "打开今日任务", "url": "http://localhost:3000/" },
      { "label": "查看待处理输入", "url": "http://localhost:3000/inbox" }
    ]
  }
}
```

## Read APIs

Read APIs require:

```http
Authorization: Bearer <PERSONAL_OS_READ_TOKEN>
```

```text
GET /api/today
GET /api/agent/context?taskId=<task_id>
GET /api/agent/context?q=<keyword>
GET /api/inbox/items
GET /api/tasks
GET /api/tasks/<id>
GET /api/notes
GET /api/projects
GET /api/activity
```

## Agent Context Harness

Personal OS does not think. Hermes does the thinking. This endpoint is a
mechanical context harness: it collects structured task data, related project
state, recent task history, activity trace, and candidate Personal Wiki notes.

Hermes must call this before executing a task:

```http
GET /api/agent/context?taskId=<task_id>
Authorization: Bearer <PERSONAL_OS_READ_TOKEN>
```

Response shape:

```json
{
  "ok": true,
  "context": {
    "task": {},
    "searchQueries": ["确认 DeepTalk 导出链路", "DeepTalk", "Telegram"],
    "wiki": {
      "status": "ok",
      "searchedQueries": ["确认 DeepTalk 导出链路", "DeepTalk", "Telegram"],
      "successfulQueries": 3,
      "failedQueries": [],
      "candidates": [
        {
          "title": "04-12 内部会议：商店后台优化与分类调整",
          "path": "vault/20_notes/...",
          "url": "http://<server-host>:3422/note?path=...",
          "matchedQueries": ["DeepTalk"],
          "score": 18
        }
      ]
    },
    "recentTasks": [],
    "activity": [],
    "policy": {
      "canReadWiki": true,
      "canSuggestWikiUpdates": true,
      "canAutoArchiveKnowledge": false,
      "mustConfirmDelete": true
    }
  }
}
```

`wiki.status` has four meanings:

| Status | Meaning | Hermes behavior |
| --- | --- | --- |
| `ok` | Wiki was reachable and candidates were found. | Read candidates, then decide what is useful. |
| `empty` | Wiki was reachable but no candidate matched. | Broaden query or proceed with task fields. |
| `partial` | Some Wiki queries failed. | Treat candidates as incomplete and retry if context matters. |
| `unavailable` | All Wiki queries failed. | Do not assume there is no knowledge; retry later. |

When Hermes has no task yet but needs a knowledge lookup, use:

```http
GET /api/agent/context?q=<keyword>
Authorization: Bearer <PERSONAL_OS_READ_TOKEN>
```

It returns the same `context` envelope. In this mode `task` is `null`,
`recentTasks` and `activity` are empty arrays, and `policy` is still present.

Important rule: these `wiki.candidates` are only candidates. Hermes decides
which notes are useful, stale, duplicate, or wrong. Personal OS only prevents
blind full-library retrieval and records what happened.

## Proactive Reminders

Agents do not wake up by themselves. Use Hermes, OpenClaw, cron, or another
scheduler as the clock, then let Personal OS generate the reminder payload.

```http
GET /api/reminders/today?mode=morning
Authorization: Bearer <PERSONAL_OS_READ_TOKEN>
```

Allowed modes:

```text
morning, checkin, evening
```

Response shape:

```json
{
  "ok": true,
  "reminder": {
    "mode": "checkin",
    "shouldSend": true,
    "metrics": {
      "now": 2,
      "review": 1,
      "waiting": 0,
      "blocked": 1,
      "doneToday": 3,
      "ideas": 2
    },
    "payload": {
      "text": "我来催一下：这些事情还挂着。\n\n今日要做 2...",
      "buttons": [
        { "label": "今日任务", "url": "http://localhost:3000/" },
        { "label": "想法池", "url": "http://localhost:3000/ideas" }
      ]
    }
  }
}
```

Hermes/OpenClaw should:

1. Call the endpoint on a schedule.
2. If `shouldSend` is false, do not bother the user.
3. If `shouldSend` is true, send `payload.text` and `payload.buttons` to Telegram.
4. Do not change task status from this reminder call. Status changes still use task APIs.

Recommended first schedule:

```text
09:30 morning  - ask what should be done today
15:00 checkin  - ask what is still hanging
21:30 evening  - ask what was done and what remains
```

## Daily Planning

Use reminders when Hermes only needs to nudge the user. Use planner when Hermes
needs to actively decide what the user should focus on today.

```http
GET /api/planner/today?mode=morning
Authorization: Bearer <PERSONAL_OS_READ_TOKEN>
```

The planner response includes:

- `planner.reminder`: today task, idea, and simple reminder state.
- `planner.projects`: active/waiting/blocked projects.
- `planner.recentActivity`: latest user/Hermes/system activity.
- `planner.wiki`: Personal Wiki candidates recalled from current work.
- `planner.plannerInstruction`: how Hermes should turn the packet into advice.

Hermes should send a short Telegram plan, not a raw dump:

```text
今天主线：
建议先做：
需要确认：
可以暂缓：
卡点最小下一步：
```

Personal OS provides facts. Hermes uses GPT to reason, rank, and speak.

## Agent Task Execution Protocol

This is the bridge between Personal OS, Personal Wiki, and autonomous agents.
Personal OS owns task state; Personal Wiki owns knowledge and evidence; agents
execute by calling this protocol.

### Poll tasks

```http
GET /api/agent-inbox?agent_id=knowledge-curator&tags=wiki,curation&limit=10
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
```

The response returns executable tasks and a `contextUrl` for each task:

```json
{
  "ok": true,
  "agentId": "knowledge-curator",
  "tasks": [
    {
      "id": "task_1",
      "title": "补齐 Personal Wiki 项目页",
      "status": "todo",
      "agentTags": ["wiki", "curation"],
      "contextUrl": "/api/agent/context?taskId=task_1"
    }
  ]
}
```

### Claim and keep the lease alive

```http
POST /api/tasks/task_1/claim
Authorization: Bearer <PERSONAL_OS_API_TOKEN>

{
  "agentId": "knowledge-curator",
  "leaseMinutes": 90
}
```

Long-running agents must heartbeat before the lease expires:

```http
POST /api/tasks/task_1/heartbeat
Authorization: Bearer <PERSONAL_OS_API_TOKEN>

{
  "agentId": "knowledge-curator",
  "leaseMinutes": 90
}
```

Script helper:

```bash
npm run agent:heartbeat -- --task-id task_1 --agent-id knowledge-curator --lease-minutes 90
```

### Load context

```http
GET /api/agent/context?taskId=task_1
Authorization: Bearer <PERSONAL_OS_READ_TOKEN>
```

The context pack includes the task, project, source inbox item, previous
contributions, artifacts, reviews, related tasks, related ideas, and Personal
Wiki candidates. Agents should not scrape the whole Wiki when this endpoint is
available.

### Write progress

```http
POST /api/tasks/task_1/contributions
Authorization: Bearer <PERSONAL_OS_API_TOKEN>

{
  "agentId": "knowledge-curator",
  "summary": "补齐了 3 个演示项目页，并把演示项目索引链接回相关笔记。",
  "evidenceLinks": ["wiki://project_personal_os"],
  "artifactUrls": ["http://localhost:3100/wiki"],
  "nextRecommendation": "建议让 reviewer agent 检查是否还有孤立概念页。"
}
```

### Submit for review

```http
POST /api/tasks/task_1/submit
Authorization: Bearer <PERSONAL_OS_API_TOKEN>

{
  "agentId": "knowledge-curator",
  "summary": "任务已完成，产物和证据见链接。",
  "artifactUrls": ["wiki://project_personal_os"],
  "definitionOfDoneMet": true,
  "needsHumanDecision": false
}
```

Submit moves the task into `review`. Agents should not mark their own work
`done`.

### Review

```http
POST /api/tasks/task_1/review
Authorization: Bearer <PERSONAL_OS_API_TOKEN>

{
  "reviewer": "user",
  "decision": "approve",
  "comment": "通过。"
}
```

Allowed decisions:

```text
approve -> done
request_changes -> todo
block -> blocked
reject -> todo
archive -> archived
```

Review is only valid for submitted tasks in `review`. Use `archive` for work
that should be discarded; use `reject` when the result failed review and should
return to the work queue.

### Agent loop

```text
poll -> claim -> context -> execute -> heartbeat -> contribution -> submit -> review
```

This loop is the minimum viable "task claiming" mechanism. The agent can be
Hermes, Codex, OpenClaw, or any other worker as long as it follows the same API.

Reusable local helpers:

```bash
npm run agent:run-next -- --claim --agent-id knowledge-curator --tags wiki,curation
npm run agent:heartbeat -- --task-id task_1 --agent-id knowledge-curator
npm run agent:writeback -- --task-id task_1 --summary "Done" --dod-met --no-human
npm run agent:smoke -- --base-url http://192.168.6.37:3100 --agent-id codex-e2e-verifier --json
```

`agent:smoke` creates and archives a synthetic low-risk task. Use it after
deployments to verify profile, intake, inbox, claim, heartbeat, contribution,
submit, review, and final task readback in one run.

Personal Wiki read pages:

```text
GET http://<server-host>:3422/
GET http://<server-host>:3422/notes
GET http://<server-host>:3422/docs/USAGE.md
GET http://<server-host>:3422/api/health
```

## Hermes Operating Rule

Unless the user explicitly says "不要入库" or "先只讨论", Hermes should:

- create an InboxItem,
- classify the input,
- send durable knowledge to Personal Wiki,
- create useful Task/ProjectEvent records in Personal OS,
- create Personal OS project notes only when the note is local project context,
- put uncertain tasks in `review`,
- record important actions into ActivityLog,
- generate a Telegram result payload.

For destructive actions, Hermes should tell the user the impact first.
