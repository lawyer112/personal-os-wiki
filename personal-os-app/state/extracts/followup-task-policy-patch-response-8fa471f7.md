# followup-task-policy-patch-response
Format: JSON
Top-level: object
Size: 2
Nested depth: 4

## Schema

- ok: boolean
- task: object (34 keys)

## Preview

```json
{
  "ok": true,
  "task": {
    "id": "cmqqqgfgm001r0jocadvkeqzz",
    "title": "实现 raw manifest 小样本 ingest 命令 v0",
    "description": "承接任务 cmqq2o6lz000w0jmj9mfh4cer 的设计产物。对象是显式传入的小样本 raw 输入目录；动作是生成/更新 raw-source-manifest，并在 dry-run 中输出 ingest/skip/update 事件；产物是可复跑 CLI、fixture 和回归测试。默认不扫描真实 vault、不删除/移动生产笔记。",
    "status": "todo",
    "priority": "P1",
    "riskLevel": "low",
    "executionMode": "agent_allowed",
    "agentTags": [
      "wiki",
      "personal-wiki",
      "manifest",
      "raw",
      "ingest",
      "script"
    ],
    "ownerAgent": null,
    "leaseUntil": null,
    "lastHeartbeatAt": null,
    "requiredOutput": "scripts/raw-manifest-ingest.mjs、3 个 fixture、manifest before/after 快照、测试/验证日志。",
    "nextAction": "在 .agent-runs/<task-id>/ 复用本轮 schema 和样例，先写 CLI dry-run，再补最小测试；只处理显式传入目录。",
    "definitionOfDone": "对 3 个 fixture 运行 dry-run 后稳定产出 ingest=1、skip=1、update=1；不会扫描真实 vault；targeted test、node --check、eslint script-only 通过；如接入 /api/intake，必须先 mock 或使用单条测试 note 并回读验证。",
    "dueDate": null,
    "estimateMinutes": 120,
    "createdBy": "hermes",
    "createdAt": "2026-06-23T14:21:47.974Z",
    "updatedAt": "2026-06-23T14:24:43.665Z",
    "completedAt": null,
    "submittedAt": null,
    "projectId": "cmqq290nm00040jmj9jwa98ya",
    "sourceInboxItemId": null,
    "sourceAgentRunId": null,
    "project": {
      "id": "cmqq290nm00040jmj9jwa98ya",
      "name": "Personal OS / Wiki 知识库升级",
      "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
      "status": "active",
      "priority": "P0",
…
```