# context-pack-intake-result
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
    "id": "cmr0nubs401ro0jpkuo682vm9",
    "sourceType": "agent-output",
    "sourcePlatform": "cron/context-pack",
    "sourceMessageId": null,
    "rawText": "AgentRun context pack archived for cmqyixt4a00n90jpk3todreos by cmr009fup01bu0jpkb1koq2h2.",
    "sourceUrl": null,
    "attachments": [],
    "status": "new",
    "createdBy": "hermes",
    "receivedAt": "2026-06-30T13:06:19.300Z",
    "updatedAt": "2026-06-30T13:06:19.300Z"
  },
  "agentRunId": "cmr0nubsa01rq0jpkdtjwi8vd",
  "project": {
    "id": "cmqq290nm00040jmj9jwa98ya",
    "name": "Personal OS / Wiki 知识库升级",
    "goal": "保持 Hermes 多 Agent 运行可观测、轻量和可恢复。",
    "status": "active",
    "priority": "P0",
    "currentFocus": "Personal OS / Wiki 自驱闭环生产化",
    "createdAt": "2026-06-23T03:04:11.410Z",
    "updatedAt": "2026-06-30T13:06:19.310Z"
  },
  "tasks": [],
  "ideas": [],
  "notes": [],
  "projectEvents": [
    {
      "id": "cmr0nux8401rt0jpk28bmxbvd",
      "projectId": "cmqq290nm00040jmj9jwa98ya",
      "title": "AgentRun context pack archived cmqyixt4a00n90jpk3todreos",
      "body": "已将 cmqyixt4a00n90jpk3todreos 的 gate、diff、测试、部署、残余风险写成 Wiki context pack。归档任务：cmr009fup01bu0jpkb1koq2h2。",
      "eventType": "agent-context-pack",
      "createdAt": "2026-06-30T13:06:47.092Z",
      "sourceInboxItemId": "cmr0nubs401ro0jpkuo682vm9",
      "sourceAgentRunId": "cmr0nubsa01rq0jpkdtjwi8vd"
    }
…
```