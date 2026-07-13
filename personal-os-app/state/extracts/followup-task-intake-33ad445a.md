# followup-task-intake
Format: JSON
Top-level: object
Size: 2
Nested depth: 6

## Schema

- status: number
- response: object (11 keys)

## Preview

```json
{
  "status": 201,
  "response": {
    "ok": true,
    "inbox": {
      "id": "cmqqfucb2001p0jn5quy9c67g",
      "sourceType": "cron",
      "sourcePlatform": "hermes-cron",
      "sourceMessageId": "followup-frontmatter-contract-20260623-092441",
      "rawText": "Follow-up from cmqq2o6gt000s0jmjpc2aqnbp deployment: Personal Wiki production requires explicit frontmatter. Personal OS wikiNotes without frontmatter degrade correctly but do not create durable Wiki notes.",
      "sourceUrl": null,
      "attachments": [],
      "status": "new",
      "createdBy": "obsidianmanager1",
      "receivedAt": "2026-06-23T09:24:41.294Z",
      "updatedAt": "2026-06-23T09:24:41.294Z"
    },
    "agentRunId": "cmqqfuchd001r0jn5felukxst",
    "project": null,
    "tasks": [
      {
        "id": "cmqqfucnt001t0jn5vd3wcn3u",
        "title": "让 Personal OS wikiNotes 自动补齐 Personal Wiki frontmatter 合约",
        "description": "生产回归证明 /api/intake 已能在 Wiki 写失败时保留 Inbox/Task/AgentRun 并返回结构化 wiki error；但 Personal Wiki 6.37 当前要求 frontmatter 对象，Personal OS wikiNotes 仅传 title/content 时会被拒绝，导致健康 Wiki 也无法落 durable note。",
        "status": "todo",
        "priority": "P1",
        "riskLevel": "low",
        "executionMode": "agent_allowed",
        "agentTags": [
          "personal-os",
          "wiki",
          "intake",
          "frontmatter",
          "bugfix"
        ],
        "ownerAgent": null,
        "leaseUntil": null,
        "lastHeartbeatAt": null,
        "requiredOutput": "代码补丁、focused tests、full tests、lint/build、6.37 部署记录、生产回归 JSON、Wiki 完成记录。",
        "nextAction": "修改 personal-os-app 的 wiki-ingest/intake 转换逻辑：当 wikiNotes 没有 frontmatter 时，根据 title/source_type/tags/sourceAgentRun/task/project 自动生成符合 Personal Wiki 的 frontmatter，并保留当前失败降级行为。",
…
```