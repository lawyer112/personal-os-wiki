# deployment-intake-result
Format: JSON
Top-level: object
Size: 2
Nested depth: 4

## Schema

- http_status: number
- result: object (11 keys)

## Preview

```json
{
  "http_status": 201,
  "result": {
    "ok": true,
    "inbox": {
      "id": "cmqqi7uwa00000jp61e8qdv1d",
      "sourceType": "agent-output",
      "sourcePlatform": "cron/personal-os-self-runner",
      "sourceMessageId": null,
      "rawText": "Agent deployed /api/agent/context tiers for task cmqqfl6hp00070jn5bgoym7dx; production regression passed.",
      "sourceUrl": null,
      "attachments": [],
      "status": "new",
      "createdBy": "hermes",
      "receivedAt": "2026-06-23T10:31:11.146Z",
      "updatedAt": "2026-06-23T10:31:11.146Z"
    },
    "agentRunId": "cmqqi7v3300020jp6kb33iqbd",
    "project": {
      "id": "cmqq290nm00040jmj9jwa98ya",
      "name": "Personal OS / Wiki 知识库升级",
      "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
      "status": "active",
      "priority": "P0",
      "currentFocus": "Personal OS / Wiki 自驱闭环生产化",
      "createdAt": "2026-06-23T03:04:11.410Z",
      "updatedAt": "2026-06-23T10:31:11.671Z"
    },
    "tasks": [],
    "ideas": [],
    "notes": [],
    "projectEvents": [
      {
        "id": "cmqqi7vc600050jp6dzq2efjc",
        "projectId": "cmqq290nm00040jmj9jwa98ya",
        "title": "/api/agent/context tiers v0 已部署并通过生产回归",
        "body": "任务 cmqqfl6hp00070jn5bgoym7dx gate=pass；备份 /data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260623-102853；生产回归确认 query/task context 均返回 tiers，兼容字段保留。",
        "eventType": "deployment",
        "createdAt": "2026-06-23T10:31:11.718Z",
        "sourceInboxItemId": "cmqqi7uwa00000jp61e8qdv1d",
…
```