# current-intake-result
Format: JSON
Top-level: object
Size: 11
Nested depth: 3

## Schema

- ok: boolean
- inbox: object (11 keys)
- agentRunId: string
- project: object (8 keys)
- tasks: array (0 items)
- ideas: array (0 items)
- notes: array (0 items)
- projectEvents: array (1 items)
- wiki: array (1 items)
- wiki_write_status: object (5 keys)
- notification: null

## Preview

```json
{
  "ok": true,
  "inbox": {
    "id": "cmr0vc988003z0jpordtha6sg",
    "sourceType": "agent-output",
    "sourcePlatform": "cron/personal-os-agent-executor",
    "sourceMessageId": null,
    "rawText": "Agent task cmr009fup01bu0jpkb1koq2h2 completed: implemented archive-agent-run.mjs and wrote live context pack intake.",
    "sourceUrl": null,
    "attachments": [],
    "status": "new",
    "createdBy": "hermes",
    "receivedAt": "2026-06-30T16:36:13.112Z",
    "updatedAt": "2026-06-30T16:36:13.112Z"
  },
  "agentRunId": "cmr0vc98x00410jpoo679y3xl",
  "project": {
    "id": "cmqq290nm00040jmj9jwa98ya",
    "name": "Personal OS / Wiki 知识库升级",
    "goal": "保持 Hermes 多 Agent 运行可观测、轻量和可恢复。",
    "status": "active",
    "priority": "P1",
    "currentFocus": "多 Agent 50-100 并发优化",
    "createdAt": "2026-06-23T03:04:11.410Z",
    "updatedAt": "2026-06-30T14:12:18.355Z"
  },
  "tasks": [],
  "ideas": [],
  "notes": [],
  "projectEvents": [
    {
      "id": "cmr0vcu7600430jpo2njtgvh4",
      "projectId": "cmqq290nm00040jmj9jwa98ya",
      "title": "实现 AgentRun context pack 自动归档 v0",
      "body": "新增 scripts/archive-agent-run.mjs；对真实 task cmqyixt4a00n90jpk3todreos 执行 live /api/intake 返回 wikiStatus=ok；lint/test pass；build 因 DATABASE_URL 缺失阻塞。",
      "eventType": "agent-run-context-pack",
      "createdAt": "2026-06-30T16:36:40.290Z",
      "sourceInboxItemId": "cmr0vc988003z0jpordtha6sg",
      "sourceAgentRunId": "cmr0vc98x00410jpoo679y3xl"
    }
…
```