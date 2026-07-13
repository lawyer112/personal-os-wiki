# intake-writeback-result
Format: JSON
Top-level: object
Size: 3
Nested depth: 4

## Schema

- ok: boolean
- status: number
- body: object (11 keys)

## Preview

```json
{
  "ok": true,
  "status": 201,
  "body": {
    "ok": true,
    "inbox": {
      "id": "cmqqocz3r000k0jocir9ayub7",
      "sourceType": "agent-output",
      "sourcePlatform": "cron/personal-os-wiki-audit",
      "sourceMessageId": null,
      "rawText": "Personal OS/Wiki 优化审计 v0：完成健康矩阵、GitHub 候选、优化点、Agent 执行队列，并准备关闭任务。",
      "sourceUrl": null,
      "attachments": [],
      "status": "new",
      "createdBy": "hermes",
      "receivedAt": "2026-06-23T13:23:07.575Z",
      "updatedAt": "2026-06-23T13:23:07.575Z"
    },
    "agentRunId": "cmqqocz4v000m0jocw3mrnrpu",
    "project": {
      "id": "cmqq290nm00040jmj9jwa98ya",
      "name": "Personal OS / Wiki 知识库升级",
      "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
      "status": "active",
      "priority": "P0",
      "currentFocus": "Personal OS / Wiki 自驱闭环生产化",
      "createdAt": "2026-06-23T03:04:11.410Z",
      "updatedAt": "2026-06-23T13:23:07.623Z"
    },
    "tasks": [],
    "ideas": [],
    "notes": [],
    "projectEvents": [
      {
        "id": "cmqqocz5k000p0jocsovnghqq",
        "projectId": "cmqq290nm00040jmj9jwa98ya",
        "title": "Personal OS/Wiki 优化审计 v0 已完成",
        "body": "已验证 Context/Intake/Wiki/GitHub 雷达与测试链路，形成 5 个优化点和 Agent 执行队列；Classic 无需拍板。",
        "eventType": "audit",
        "createdAt": "2026-06-23T13:23:07.640Z",
…
```