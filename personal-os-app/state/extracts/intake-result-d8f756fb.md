# intake-result
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
      "id": "cmqqi217400190jo5dd0cgxo5",
      "sourceType": "agent-output",
      "sourcePlatform": "cron/personal-os-self-runner",
      "sourceMessageId": null,
      "rawText": "Agent implemented local /api/agent/context tiers for task cmqqfl6hp00070jn5bgoym7dx; deployment blocked by missing 6.37 access.",
      "sourceUrl": null,
      "attachments": [],
      "status": "new",
      "createdBy": "hermes",
      "receivedAt": "2026-06-23T10:26:39.376Z",
      "updatedAt": "2026-06-23T10:26:39.376Z"
    },
    "agentRunId": "cmqqi219d001b0jo5882m51rh",
    "project": {
      "id": "cmqq290nm00040jmj9jwa98ya",
      "name": "Personal OS / Wiki 知识库升级",
      "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
      "status": "active",
      "priority": "P0",
      "currentFocus": "Personal OS / Wiki 自驱闭环生产化",
      "createdAt": "2026-06-23T03:04:11.410Z",
      "updatedAt": "2026-06-23T10:26:39.489Z"
    },
    "tasks": [],
    "ideas": [],
    "notes": [],
    "projectEvents": [
      {
        "id": "cmqqi21ly001e0jo5ednarr2u",
        "projectId": "cmqq290nm00040jmj9jwa98ya",
        "title": "/api/agent/context tiers v0 已本地实现但部署受阻",
        "body": "任务 cmqqfl6hp00070jn5bgoym7dx 已完成本地代码与验证；gate=blocked，因为当前运行环境没有 6.37 SSH/Docker 部署通道。产物见 .agent-runs/cmqqfl6hp00070jn5bgoym7dx/。",
        "eventType": "agent-run-blocked",
        "createdAt": "2026-06-23T10:26:39.910Z",
        "sourceInboxItemId": "cmqqi217400190jo5dd0cgxo5",
…
```