# intake-result
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
    "id": "cmr0ut90t003s0jpom9utxoyv",
    "sourceType": "agent-output",
    "sourcePlatform": "cron/personal-os-agent-executor",
    "sourceMessageId": null,
    "rawText": "AgentRun context pack archived for cmqyixt4a00n90jpk3todreos: gate=pass",
    "sourceUrl": null,
    "attachments": [],
    "status": "new",
    "createdBy": "hermes",
    "receivedAt": "2026-06-30T16:21:26.381Z",
    "updatedAt": "2026-06-30T16:21:26.381Z"
  },
  "agentRunId": "cmr0ut91d003u0jpoq2tbn0jt",
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
      "id": "cmr0utu80003w0jpoua57lizk",
      "projectId": "cmqq290nm00040jmj9jwa98ya",
      "title": "AgentRun context pack 已归档：cmqyixt4a00n90jpk3todreos",
      "body": "gate=pass；归档内容包含 worker-result、gate、验证、部署、残余风险和产物索引。",
      "eventType": "agent-run-context-pack",
      "createdAt": "2026-06-30T16:21:53.856Z",
      "sourceInboxItemId": "cmr0ut90t003s0jpom9utxoyv",
      "sourceAgentRunId": "cmr0ut91d003u0jpoq2tbn0jt"
    }
…
```