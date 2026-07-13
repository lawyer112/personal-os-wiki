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
    "id": "cmqr28oxg000a0jpmzr2j7p09",
    "sourceType": "agent-output",
    "sourcePlatform": "cron/context-pack",
    "sourceMessageId": null,
    "rawText": "AgentRun context pack archived for cmqq29yi9000c0jmjcejamrel by cmqqxals8000f0jpj7dgqj12m.",
    "sourceUrl": null,
    "attachments": [],
    "status": "new",
    "createdBy": "hermes",
    "receivedAt": "2026-06-23T19:51:42.388Z",
    "updatedAt": "2026-06-23T19:51:42.388Z"
  },
  "agentRunId": "cmqr28oy1000c0jpm5u81nl51",
  "project": {
    "id": "cmqq290nm00040jmj9jwa98ya",
    "name": "Personal OS / Wiki 知识库升级",
    "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
    "status": "active",
    "priority": "P0",
    "currentFocus": "Personal OS / Wiki 自驱闭环生产化",
    "createdAt": "2026-06-23T03:04:11.410Z",
    "updatedAt": "2026-06-23T19:51:42.414Z"
  },
  "tasks": [],
  "ideas": [],
  "notes": [],
  "projectEvents": [
    {
      "id": "cmqr28oyi000f0jpmo1p4y2ir",
      "projectId": "cmqq290nm00040jmj9jwa98ya",
      "title": "AgentRun context pack archived cmqq29yi9000c0jmjcejamrel",
      "body": "已将 cmqq29yi9000c0jmjcejamrel 的 gate、diff、测试、部署、残余风险写成 Wiki context pack。归档任务：cmqqxals8000f0jpj7dgqj12m。",
      "eventType": "agent-context-pack",
      "createdAt": "2026-06-23T19:51:42.426Z",
      "sourceInboxItemId": "cmqr28oxg000a0jpmzr2j7p09",
      "sourceAgentRunId": "cmqr28oy1000c0jpm5u81nl51"
    }
…
```