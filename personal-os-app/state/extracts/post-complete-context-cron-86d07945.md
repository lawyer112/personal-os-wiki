# post-complete-context-cron
Format: JSON
Top-level: object
Size: 2
Nested depth: 6

## Schema

- ok: boolean
- context: object (9 keys)

## Preview

```json
{
  "ok": true,
  "context": {
    "generatedAt": "2026-06-23T12:43:08.443Z",
    "task": {
      "id": "cmqq4eqa800340jmjz1go2euo",
      "title": "定义 Classic Knowledge Object Manifest v0",
      "description": "给任务/项目/证据/决策/SOP/Hub 定义统一元数据：id/type/source/hash/freshness/sensitivity 等。",
      "status": "done",
      "priority": "P0",
      "riskLevel": "low",
      "executionMode": "agent_allowed",
      "agentTags": [
        "manifest",
        "knowledge",
        "wiki",
        "schema"
      ],
      "ownerAgent": null,
      "leaseUntil": null,
      "lastHeartbeatAt": "2026-06-23T08:52:45.799Z",
      "requiredOutput": "classic-knowledge-object-manifest.schema.json + 3 个样例对象。",
      "nextAction": "根据 council-report-v1.md 写 schema 和 lint 检查项。",
      "definitionOfDone": "任意知识对象可追 source_path/hash/freshness/sensitivity；无来源内容标记 speculative。",
      "dueDate": null,
      "estimateMinutes": 90,
      "createdBy": "hermes",
      "createdAt": "2026-06-23T04:04:37.136Z",
      "updatedAt": "2026-06-23T12:43:06.015Z",
      "completedAt": "2026-06-23T12:43:06.003Z",
      "submittedAt": "2026-06-23T08:52:45.799Z",
      "projectId": "cmqq290nm00040jmj9jwa98ya",
      "sourceInboxItemId": "cmqq4epm7002t0jmjebb1h78o",
      "sourceAgentRunId": "cmqq4epqb002v0jmjrtd29afg",
      "project": {
        "id": "cmqq290nm00040jmj9jwa98ya",
        "name": "Personal OS / Wiki 知识库升级",
        "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
        "status": "active",
        "priority": "P0",
…
```