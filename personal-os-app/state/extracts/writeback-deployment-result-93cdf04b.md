# writeback-deployment-result
Format: JSON
Top-level: object
Size: 2
Nested depth: 9

## Schema

- review: object (2 keys)
- intake: object (2 keys)

## Preview

```json
{
  "review": {
    "status": 200,
    "body": {
      "ok": true,
      "task": {
        "id": "cmqqb0d7h00050jnsh6q221l1",
        "title": "实现 wikiClient 读写分离抽象并补齐 401 / 降级测试",
        "description": "把 WIKI_READ_TOKEN 与 WIKI_API_TOKEN 的职责固化进 client abstraction，避免读接口拿写 token 或写接口拿读 token；同时保持 /api/intake 在 Wiki 失败时不阻断 OS 写入。",
        "status": "done",
        "priority": "P0",
        "riskLevel": "medium",
        "executionMode": "agent_allowed",
        "agentTags": [
          "personal-os",
          "personal-wiki",
          "wiki-client",
          "auth"
        ],
        "ownerAgent": null,
        "leaseUntil": null,
        "lastHeartbeatAt": "2026-06-23T08:21:24.652Z",
        "requiredOutput": "代码 diff、测试用例、CI 通过结果、生产回归记录。",
        "nextAction": "在 personal-os-app/src/lib/wiki-client.ts 中拆分 read/write client，并新增 token matrix 测试。",
        "definitionOfDone": "npm test、tsc、lint、build 全通过；读 token 只能读、写 token 只能写；/api/intake Wiki 写失败仍返回 201 并记录 wiki_write_status。",
        "dueDate": null,
        "estimateMinutes": 120,
        "createdBy": "hermes",
        "createdAt": "2026-06-23T07:09:24.317Z",
        "updatedAt": "2026-06-23T09:07:01.801Z",
        "completedAt": "2026-06-23T09:07:01.566Z",
        "submittedAt": "2026-06-23T08:21:24.652Z",
        "projectId": "cmqq290nm00040jmj9jwa98ya",
        "sourceInboxItemId": "cmqqb0cgl00000jnsnx6e8s2i",
        "sourceAgentRunId": "cmqqb0coj00020jns1toyk3th",
        "project": {
          "id": "cmqq290nm00040jmj9jwa98ya",
          "name": "Personal OS / Wiki 知识库升级",
          "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
          "status": "active",
…
```