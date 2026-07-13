# task-review-result
Format: JSON
Top-level: object
Size: 3
Nested depth: 8

## Schema

- ok: boolean
- status: number
- body: object (3 keys)

## Preview

```json
{
  "ok": true,
  "status": 200,
  "body": {
    "ok": true,
    "task": {
      "id": "cmqq29yi9000c0jmjcejamrel",
      "title": "产出 Personal OS/Wiki 优化审计 v0",
      "description": "Classic 已把知识库维护和升级交给 Hermes。今天先判断 6.37 现有链路哪里最该优化，并给出可执行队列。",
      "status": "done",
      "priority": "P0",
      "riskLevel": "low",
      "executionMode": "agent_allowed",
      "agentTags": [
        "hermes",
        "personal-os",
        "wiki",
        "audit",
        "rag"
      ],
      "ownerAgent": null,
      "leaseUntil": null,
      "lastHeartbeatAt": "2026-06-23T13:23:07.658Z",
      "requiredOutput": "审计报告：健康矩阵、3-5 个优化点、GitHub 候选清单、Agent 执行队列、Classic 需拍板项。",
      "nextAction": "检查 6.37 Context/Intake/Wiki 鉴权与写入状态，检索 GitHub 候选并形成 v0 优化清单。",
      "definitionOfDone": "给 Classic 一份 v0 报告；每个优化点都有对象、动作、产物和验收标准；需要 Classic 拍板的事项单独列出。",
      "dueDate": null,
      "estimateMinutes": 120,
      "createdBy": "hermes",
      "createdAt": "2026-06-23T03:04:55.281Z",
      "updatedAt": "2026-06-23T13:23:07.725Z",
      "completedAt": "2026-06-23T13:23:07.722Z",
      "submittedAt": "2026-06-23T13:23:07.658Z",
      "projectId": "cmqq290nm00040jmj9jwa98ya",
      "sourceInboxItemId": "cmqq29wmk00050jmj4xn5931o",
      "sourceAgentRunId": "cmqq29y1n00070jmjwh2exq1g",
      "project": {
        "id": "cmqq290nm00040jmj9jwa98ya",
        "name": "Personal OS / Wiki 知识库升级",
        "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
…
```