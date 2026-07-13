# task-review-response
Format: JSON
Top-level: object
Size: 3
Nested depth: 7

## Schema

- ok: boolean
- task: object (33 keys)
- review: object (6 keys)

## Preview

```json
{
  "ok": true,
  "task": {
    "id": "cmqq2o6lz000w0jmj9mfh4cer",
    "title": "设计 _raw + manifest 增量入库试验",
    "description": "吸收 Ar9av/llmwiki 的 _raw 暂存和 manifest delta tracking，降低重复加工和手工入库成本。",
    "status": "done",
    "priority": "P1",
    "riskLevel": "low",
    "executionMode": "agent_allowed",
    "agentTags": [
      "wiki",
      "manifest",
      "raw",
      "workflow"
    ],
    "ownerAgent": null,
    "leaseUntil": null,
    "lastHeartbeatAt": "2026-06-23T14:14:13.989Z",
    "requiredOutput": "目录约定、manifest JSON schema、一次 ingest 流程、重复文件跳过规则。",
    "nextAction": "先在本地报告里写 schema 和伪代码；不改生产目录。",
    "definitionOfDone": "能用 3 个样例文件说明 ingest、skip、update 三种路径。",
    "dueDate": null,
    "estimateMinutes": 90,
    "createdBy": "hermes",
    "createdAt": "2026-06-23T03:15:58.967Z",
    "updatedAt": "2026-06-23T14:14:14.048Z",
    "completedAt": "2026-06-23T14:14:14.046Z",
    "submittedAt": "2026-06-23T14:14:13.989Z",
    "projectId": "cmqq290nm00040jmj9jwa98ya",
    "sourceInboxItemId": "cmqq2o5yh000j0jmjus8lrd06",
    "sourceAgentRunId": "cmqq2o63r000l0jmjbrv5nr4z",
    "project": {
      "id": "cmqq290nm00040jmj9jwa98ya",
      "name": "Personal OS / Wiki 知识库升级",
      "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
      "status": "active",
      "priority": "P0",
      "currentFocus": "Personal OS / Wiki 自驱闭环生产化",
      "createdAt": "2026-06-23T03:04:11.410Z",
…
```