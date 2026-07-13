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
    "id": "cmqravk40002g0js0ukmnww94",
    "sourceType": "agent-output",
    "sourcePlatform": "cron/github-radar",
    "sourceMessageId": null,
    "rawText": "GitHub 雷达运行：筛选 8 个 repo，生成 0 个候选任务。",
    "sourceUrl": null,
    "attachments": [],
    "status": "new",
    "createdBy": "hermes",
    "receivedAt": "2026-06-23T23:53:26.160Z",
    "updatedAt": "2026-06-23T23:53:26.160Z"
  },
  "agentRunId": "cmqravk4p002i0js0yvtl6w0i",
  "project": {
    "id": "cmqq290nm00040jmj9jwa98ya",
    "name": "Personal OS / Wiki 知识库升级",
    "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
    "status": "active",
    "priority": "P0",
    "currentFocus": "GitHub 外部方案转成 Agent 自驱执行闭环",
    "createdAt": "2026-06-23T03:04:11.410Z",
    "updatedAt": "2026-06-23T23:53:26.190Z"
  },
  "tasks": [],
  "ideas": [],
  "notes": [],
  "projectEvents": [
    {
      "id": "cmqravk54002l0js0szkp23eq",
      "projectId": "cmqq290nm00040jmj9jwa98ya",
      "title": "GitHub 雷达已生成可执行吸收候选",
      "body": "筛选 8 个 repo；主要信号：source-registry, context-pack, memory-tiering, graph-recall, agent-hooks, doctor-next",
      "eventType": "github-radar",
      "createdAt": "2026-06-23T23:53:26.200Z",
      "sourceInboxItemId": "cmqravk40002g0js0ukmnww94",
      "sourceAgentRunId": "cmqravk4p002i0js0yvtl6w0i"
    }
…
```