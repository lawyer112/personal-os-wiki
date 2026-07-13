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
    "id": "cmqr1mg8600020jpme21yic2a",
    "sourceType": "agent-output",
    "sourcePlatform": "cron/context-pack",
    "sourceMessageId": null,
    "rawText": "AgentRun context pack archived for cmqqxals8000f0jpj7dgqj12m by cmqqxals8000f0jpj7dgqj12m.",
    "sourceUrl": null,
    "attachments": [],
    "status": "new",
    "createdBy": "hermes",
    "receivedAt": "2026-06-23T19:34:24.678Z",
    "updatedAt": "2026-06-23T19:34:24.678Z"
  },
  "agentRunId": "cmqr1mg8f00040jpmnjwmgk6b",
  "project": {
    "id": "cmqq290nm00040jmj9jwa98ya",
    "name": "Personal OS / Wiki 知识库升级",
    "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
    "status": "active",
    "priority": "P0",
    "currentFocus": "Personal OS / Wiki 自驱闭环生产化",
    "createdAt": "2026-06-23T03:04:11.410Z",
    "updatedAt": "2026-06-23T19:34:24.697Z"
  },
  "tasks": [],
  "ideas": [],
  "notes": [],
  "projectEvents": [
    {
      "id": "cmqr1mg9400070jpmwlz32kbe",
      "projectId": "cmqq290nm00040jmj9jwa98ya",
      "title": "AgentRun context pack archived cmqqxals8000f0jpj7dgqj12m",
      "body": "已将 cmqqxals8000f0jpj7dgqj12m 的 gate、diff、测试、部署、残余风险写成 Wiki context pack。归档任务：cmqqxals8000f0jpj7dgqj12m。",
      "eventType": "agent-context-pack",
      "createdAt": "2026-06-23T19:34:24.712Z",
      "sourceInboxItemId": "cmqr1mg8600020jpme21yic2a",
      "sourceAgentRunId": "cmqr1mg8f00040jpmnjwmgk6b"
    }
…
```