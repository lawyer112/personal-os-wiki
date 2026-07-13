# intake-writeback-cron
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
    "id": "cmqqmxhzb00070joc8xvcv1ac",
    "sourceType": "agent-output",
    "sourcePlatform": "cron/personal-os-autopilot",
    "sourceMessageId": null,
    "rawText": "Agent completed, deployed, and production-regressed Classic Knowledge Object Manifest v0 for task cmqq4eqa800340jmjz1go2euo.",
    "sourceUrl": null,
    "attachments": [],
    "status": "new",
    "createdBy": "obsidianmanager1",
    "receivedAt": "2026-06-23T12:43:05.927Z",
    "updatedAt": "2026-06-23T12:43:05.927Z"
  },
  "agentRunId": "cmqqmxi0g00090joc42p14q49",
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
      "id": "cmqqmxi0v000b0jock78p8wmt",
      "projectId": "cmqq290nm00040jmj9jwa98ya",
      "title": "Classic Knowledge Object Manifest v0 已部署到 6.37",
      "body": "任务 cmqq4eqa800340jmjz1go2euo gate=pass；已备份到 /data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260623T121146Z；已复制 8 个已验证文件，docker compose build/up personal-os 成功；生产 context/task-context/docker ps/deployed manifest lint/sha256 match 全部通过。",
      "eventType": "agent-deployment",
      "createdAt": "2026-06-23T12:43:05.983Z",
      "sourceInboxItemId": "cmqqmxhzb00070joc8xvcv1ac",
      "sourceAgentRunId": "cmqqmxi0g00090joc42p14q49"
    }
…
```