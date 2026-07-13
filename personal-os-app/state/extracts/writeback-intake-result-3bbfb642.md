# writeback-intake-result
Format: JSON
Top-level: object
Size: 2
Nested depth: 4

## Schema

- status: number
- body: object (11 keys)

## Preview

```json
{
  "status": 201,
  "body": {
    "ok": true,
    "inbox": {
      "id": "cmqqh09r7000l0jo5ae2end9c",
      "sourceType": "agent-output",
      "sourcePlatform": "cron/personal-os-worker",
      "sourceMessageId": null,
      "rawText": "任务 cmqqfucnt001t0jn5vd3wcn3u 完成：Personal OS wikiNotes frontmatter contract 修复、验证、部署、生产回归。",
      "sourceUrl": null,
      "attachments": [],
      "status": "new",
      "createdBy": "hermes",
      "receivedAt": "2026-06-23T09:57:17.539Z",
      "updatedAt": "2026-06-23T09:57:17.539Z"
    },
    "agentRunId": "cmqqh09v1000n0jo54k8gdrp3",
    "project": {
      "id": "cmqq290nm00040jmj9jwa98ya",
      "name": "Personal OS / Wiki 知识库升级",
      "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
      "status": "active",
      "priority": "P0",
      "currentFocus": "Personal OS / Wiki 自驱闭环生产化",
      "createdAt": "2026-06-23T03:04:11.410Z",
      "updatedAt": "2026-06-23T09:57:17.902Z"
    },
    "tasks": [],
    "ideas": [],
    "notes": [],
    "projectEvents": [
      {
        "id": "cmqqh0a6f000q0jo5ck0a8zc6",
        "projectId": "cmqq290nm00040jmj9jwa98ya",
        "title": "已部署 Personal OS wikiNotes frontmatter 合约修复",
        "body": "task_id=cmqqfucnt001t0jn5vd3wcn3u; gate=pass; backup=/data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260623T095149Z; production success/fallback regressions passed.",
        "eventType": "agent-deployment",
        "createdAt": "2026-06-23T09:57:18.087Z",
        "sourceInboxItemId": "cmqqh09r7000l0jo5ae2end9c",
…
```