# task-tag-policy-repair-result
Format: JSON
Top-level: object
Size: 2
Nested depth: 8

## Schema

- status: number
- body: object (2 keys)

## Preview

```json
{
  "status": 200,
  "body": {
    "ok": true,
    "task": {
      "id": "cmqqfl6rk00090jn58kastmq9",
      "title": "实现 AgentRun context pack 自动归档 v0",
      "description": "对象是 .agent-runs/<task-id>/ 产物；动作是提取 gate、worker-result、diff、测试、部署和风险，生成 Wiki note 并关联 Task/AgentRun；产物是自动归档脚本或服务函数。吸收 SwarmVault 的 context pack + task ledger 设计。",
      "status": "todo",
      "priority": "P1",
      "riskLevel": "low",
      "executionMode": "agent_allowed",
      "agentTags": [
        "personal-wiki",
        "agent-run",
        "context-pack",
        "wiki"
      ],
      "ownerAgent": null,
      "leaseUntil": null,
      "lastHeartbeatAt": null,
      "requiredOutput": "一个归档入口，能把指定 .agent-runs/<task-id>/ 目录写成 Wiki note，并在 Personal OS task/activity 中留下 artifact 链接。",
      "nextAction": "用 cmqqb0d7h00050jnsh6q221l1 作为样例，定义 context pack markdown 模板和字段映射。",
      "definitionOfDone": "对一个真实 task-id 运行后，Wiki 中存在包含 task_id、gate、diff、测试、部署、残余风险的 note；Personal OS 返回 201；不泄露 token。",
      "dueDate": null,
      "estimateMinutes": 90,
      "createdBy": "hermes",
      "createdAt": "2026-06-23T09:17:34.208Z",
      "updatedAt": "2026-06-23T11:09:00.584Z",
      "completedAt": null,
      "submittedAt": null,
      "projectId": "cmqq290nm00040jmj9jwa98ya",
      "sourceInboxItemId": "cmqqfl5em00000jn5p7wmb0gd",
      "sourceAgentRunId": "cmqqfl5ye00020jn5zg0mimeb",
      "project": {
        "id": "cmqq290nm00040jmj9jwa98ya",
        "name": "Personal OS / Wiki 知识库升级",
        "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
        "status": "active",
        "priority": "P0",
…
```