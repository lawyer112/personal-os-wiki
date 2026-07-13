# review-result
Format: JSON
Top-level: object
Size: 3
Nested depth: 7

## Schema

- httpStatus: number
- ok: boolean
- body: object (3 keys)

## Preview

```json
{
  "httpStatus": 200,
  "ok": true,
  "body": {
    "ok": true,
    "task": {
      "id": "cmqyixt4a00n90jpk3todreos",
      "title": "GitHub 雷达 2026-06-29：评估 rohitg00/agentmemory 的吸收价值",
      "description": "本轮雷达发现 rohitg00/agentmemory（stars: 24226, updated: undefined 前）。描述：#1 Persistent memory for AI coding agents based on real-world benchmarks。匹配信号：source-registry。把外部来源写成 source ledger：repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki + Task。",
      "status": "done",
      "priority": "P0",
      "riskLevel": "low",
      "executionMode": "agent_allowed",
      "agentTags": [
        "personal-os",
        "personal-wiki",
        "github-radar",
        "agent-self-improvement"
      ],
      "ownerAgent": null,
      "leaseUntil": null,
      "lastHeartbeatAt": "2026-06-30T02:06:13.713Z",
      "requiredOutput": "产出 Wiki 评估笔记：该 repo 的核心能力、与 Personal OS/Wiki 的适配点、可吸收设计、风险；如值得吸收，创建子任务。",
      "nextAction": "本轮雷达发现 rohitg00/agentmemory（stars: 24226, updated: undefined 前）。描述：#1 Persistent memory for AI coding agents based on real-world benchmarks。匹配信号：source-registry。把外部来源写成 source ledger：repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki + Task。",
      "definitionOfDone": "产出 Wiki 评估笔记：该 repo 的核心能力、与 Personal OS/Wiki 的适配点、可吸收设计、风险；如值得吸收，创建子任务。",
      "dueDate": null,
      "estimateMinutes": 120,
      "createdBy": "hermes",
      "createdAt": "2026-06-29T01:13:31.306Z",
      "updatedAt": "2026-06-30T19:14:40.907Z",
      "completedAt": "2026-06-30T19:14:40.865Z",
      "submittedAt": "2026-06-30T02:06:13.713Z",
      "projectId": "cmqq290nm00040jmj9jwa98ya",
      "sourceInboxItemId": "cmqyixh8u00n40jpkr2wy52xt",
      "sourceAgentRunId": "cmqyixh9a00n60jpkzr9k61p2",
      "project": {
        "id": "cmqq290nm00040jmj9jwa98ya",
        "name": "Personal OS / Wiki 知识库升级",
        "goal": "保持 Hermes 多 Agent 运行可观测、轻量和可恢复。",
        "status": "active",
…
```