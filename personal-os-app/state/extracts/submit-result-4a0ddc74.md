# submit-result
Format: JSON
Top-level: object
Size: 2
Nested depth: 8

## Schema

- http_status: number
- result: object (5 keys)

## Preview

```json
{
  "http_status": 200,
  "result": {
    "ok": true,
    "task": {
      "id": "cmqqfl6hp00070jn5bgoym7dx",
      "title": "把 /api/agent/context 输出升级为 hot/warm/cold 三层上下文 v0",
      "description": "对象是 Personal OS agent context API；动作是按执行优先级给任务、Wiki、Activity、Idea 分层；产物是 tiers 字段和测试。吸收 knowledge-base-server 的三层记忆设计。",
      "status": "review",
      "priority": "P0",
      "riskLevel": "low",
      "executionMode": "agent_allowed",
      "agentTags": [
        "personal-os",
        "context",
        "memory-tiering"
      ],
      "ownerAgent": null,
      "leaseUntil": null,
      "lastHeartbeatAt": "2026-06-23T10:27:00.509Z",
      "requiredOutput": "/api/agent/context JSON 增加 tiers.hot、tiers.warm、tiers.cold；保留兼容字段；新增测试覆盖空结果、当前任务、历史 Wiki 命中。",
      "nextAction": "阅读 src/app/api/agent/context/route.ts 和相关 service，定义分层规则并写失败测试。",
      "definitionOfDone": "query=personal os wiki 时返回 hot/warm/cold；hot 至少含当前 P0/P1 agent_allowed task 或最近阻塞；npm test、tsc、lint、build 全通过。",
      "dueDate": null,
      "estimateMinutes": 120,
      "createdBy": "hermes",
      "createdAt": "2026-06-23T09:17:33.853Z",
      "updatedAt": "2026-06-23T10:27:00.544Z",
      "completedAt": null,
      "submittedAt": "2026-06-23T10:27:00.509Z",
      "projectId": "cmqq290nm00040jmj9jwa98ya",
      "sourceInboxItemId": "cmqqfl5em00000jn5p7wmb0gd",
      "sourceAgentRunId": "cmqqfl5ye00020jn5zg0mimeb",
      "project": {
        "id": "cmqq290nm00040jmj9jwa98ya",
        "name": "Personal OS / Wiki 知识库升级",
        "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
        "status": "active",
        "priority": "P0",
        "currentFocus": "Personal OS / Wiki 自驱闭环生产化",
…
```