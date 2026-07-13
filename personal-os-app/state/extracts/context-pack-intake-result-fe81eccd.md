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
    "id": "cmqqjsvtd000i0jp6dnc2hwch",
    "sourceType": "agent-output",
    "sourcePlatform": "cron/context-pack",
    "sourceMessageId": null,
    "rawText": "AgentRun context pack archived for cmqqfl6hp00070jn5bgoym7dx by cmqqfl6rk00090jn58kastmq9.",
    "sourceUrl": null,
    "attachments": [],
    "status": "new",
    "createdBy": "hermes",
    "receivedAt": "2026-06-23T11:15:31.730Z",
    "updatedAt": "2026-06-23T11:15:31.730Z"
  },
  "agentRunId": "cmqqjsvva000k0jp6mothwp9k",
  "project": {
    "id": "cmqq290nm00040jmj9jwa98ya",
    "name": "Personal OS / Wiki 知识库升级",
    "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
    "status": "active",
    "priority": "P0",
    "currentFocus": "Personal OS / Wiki 自驱闭环生产化",
    "createdAt": "2026-06-23T03:04:11.410Z",
    "updatedAt": "2026-06-23T11:15:32.018Z"
  },
  "tasks": [],
  "ideas": [],
  "notes": [],
  "projectEvents": [
    {
      "id": "cmqqjsw6m000n0jp6n45qk2u6",
      "projectId": "cmqq290nm00040jmj9jwa98ya",
      "title": "AgentRun context pack archived cmqqfl6hp00070jn5bgoym7dx",
      "body": "已将 cmqqfl6hp00070jn5bgoym7dx 的 gate、diff、测试、部署、残余风险写成 Wiki context pack。归档任务：cmqqfl6rk00090jn58kastmq9。",
      "eventType": "agent-context-pack",
      "createdAt": "2026-06-23T11:15:32.206Z",
      "sourceInboxItemId": "cmqqjsvtd000i0jp6dnc2hwch",
      "sourceAgentRunId": "cmqqjsvva000k0jp6mothwp9k"
    }
…
```