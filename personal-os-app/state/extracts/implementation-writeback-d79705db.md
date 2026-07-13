# implementation-writeback
Format: JSON
Top-level: object
Size: 7
Nested depth: 9

## Schema

- complete: object (2 keys)
- intake_status: number
- intake_ok: boolean
- wiki_write_status: object (5 keys)
- inbox_id: string
- agentRunId: string
- wiki: array (1 items)

## Preview

```json
{
  "complete": {
    "status": 200,
    "body": {
      "ok": true,
      "task": {
        "id": "cmqqfl6ge00050jn5l2cdt228",
        "title": "实现 GitHub 知识雷达写回流水线 v0",
        "description": "把 GitHub 检索结果从“链接列表”升级为可追溯资产：repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写入 Wiki + Agent 可执行任务。对象是 GitHub 雷达输出；动作是脚本化检索、评分、写回；产物是可复跑脚本和一条 Wiki 记录。",
        "status": "done",
        "priority": "P0",
        "riskLevel": "low",
        "executionMode": "agent_allowed",
        "agentTags": [
          "personal-os",
          "github-radar",
          "agent-self-improvement"
        ],
        "ownerAgent": null,
        "leaseUntil": null,
        "lastHeartbeatAt": null,
        "requiredOutput": "personal-os-app/scripts/github-radar-intake.mjs 或等价脚本；.agent-runs/<run-id>/repos.json、evidence.md、adoption-tasks.json；一次真实 /api/intake 写回记录。",
        "nextAction": "编写脚本：按固定查询检索 GitHub repo，抓 README，按适配度/新鲜度/可执行性评分，生成 evidence.md 和 tasks payload。",
        "definitionOfDone": "运行脚本后能在 120 分钟内完成一次 GitHub 雷达：至少 5 个 repo、1 条 Wiki note、至少 2 个 agent_allowed 任务；日志不含 token；npm test/tsc/lint 或脚本级测试通过。",
        "dueDate": null,
        "estimateMinutes": 120,
        "createdBy": "hermes",
        "createdAt": "2026-06-23T09:17:33.806Z",
        "updatedAt": "2026-06-23T09:27:27.654Z",
        "completedAt": "2026-06-23T09:27:27.654Z",
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