# submit-result
Format: JSON
Top-level: object
Size: 4
Nested depth: 6

## Schema

- ok: boolean
- task: object (31 keys)
- contribution: object (8 keys)
- artifacts: array (1 items)

## Preview

```json
{
  "ok": true,
  "task": {
    "id": "cmr009fup01bu0jpkb1koq2h2",
    "title": "实现 AgentRun context pack 自动归档 v0",
    "description": "对象是 .agent-runs/<task-id>/ 产物；动作是提取 worker-result、gate、source-ledger、测试、部署和风险并生成 Wiki note；产物是归档入口和一次真实 task_id 回放样例。",
    "status": "review",
    "priority": "P1",
    "riskLevel": "low",
    "executionMode": "agent_allowed",
    "agentTags": [
      "personal-os",
      "personal-wiki",
      "agent-run",
      "context-pack"
    ],
    "ownerAgent": null,
    "leaseUntil": null,
    "lastHeartbeatAt": "2026-06-30T16:38:15.015Z",
    "requiredOutput": null,
    "nextAction": "读取 .agent-runs/cmqyixt4a00n90jpk3todreos/ 下的 worker-result.json、gate.json、source-ledger/evidence.md，生成可通过 /api/intake 写回的 Wiki note。",
    "definitionOfDone": "对真实 task-id 运行后，Wiki note 包含 task_id、gate、diff、测试、部署、残余风险；Personal OS intake 返回 ok；不泄露 token。",
    "dueDate": null,
    "estimateMinutes": 120,
    "createdBy": "hermes",
    "createdAt": "2026-06-30T02:06:13.633Z",
    "updatedAt": "2026-06-30T16:38:15.019Z",
    "completedAt": null,
    "submittedAt": "2026-06-30T16:38:15.015Z",
    "projectId": "cmqq290nm00040jmj9jwa98ya",
    "sourceInboxItemId": "cmr008wu401bp0jpkj7x4k8l4",
    "sourceAgentRunId": "cmr008wut01br0jpkkdbcvj15",
    "project": {
      "id": "cmqq290nm00040jmj9jwa98ya",
      "name": "Personal OS / Wiki 知识库升级",
      "goal": "保持 Hermes 多 Agent 运行可观测、轻量和可恢复。",
      "status": "active",
      "priority": "P1",
      "currentFocus": "多 Agent 50-100 并发优化",
      "createdAt": "2026-06-23T03:04:11.410Z",
…
```