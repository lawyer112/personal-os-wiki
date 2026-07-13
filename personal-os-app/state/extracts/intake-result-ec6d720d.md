# intake-result
Format: JSON
Top-level: object
Size: 11
Nested depth: 6

## Schema

- ok: boolean
- inbox: object (11 keys)
- agentRunId: string
- project: object (8 keys)
- tasks: array (1 items)
- ideas: array (0 items)
- notes: array (0 items)
- projectEvents: array (1 items)
- wiki: array (1 items)
- wiki_write_status: object (5 keys)
- notification: null

## Preview

```json
{
  "ok": true,
  "inbox": {
    "id": "cmqyixh8u00n40jpkr2wy52xt",
    "sourceType": "agent-output",
    "sourcePlatform": "cron/github-radar",
    "sourceMessageId": null,
    "rawText": "GitHub 雷达运行：筛选 8 个 repo，生成 1 个候选任务。",
    "sourceUrl": null,
    "attachments": [],
    "status": "new",
    "createdBy": "hermes",
    "receivedAt": "2026-06-29T01:13:15.918Z",
    "updatedAt": "2026-06-29T01:13:15.918Z"
  },
  "agentRunId": "cmqyixh9a00n60jpkzr9k61p2",
  "project": {
    "id": "cmqq290nm00040jmj9jwa98ya",
    "name": "Personal OS / Wiki 知识库升级",
    "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
    "status": "active",
    "priority": "P0",
    "currentFocus": "GitHub 外部方案转成 Agent 自驱执行闭环",
    "createdAt": "2026-06-23T03:04:11.410Z",
    "updatedAt": "2026-06-29T01:13:15.943Z"
  },
  "tasks": [
    {
      "id": "cmqyixt4a00n90jpk3todreos",
      "title": "GitHub 雷达 2026-06-29：评估 rohitg00/agentmemory 的吸收价值",
      "description": "本轮雷达发现 rohitg00/agentmemory（stars: 24226, updated: undefined 前）。描述：#1 Persistent memory for AI coding agents based on real-world benchmarks。匹配信号：source-registry。把外部来源写成 source ledger：repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki + Task。",
      "status": "todo",
      "priority": "P0",
      "riskLevel": "low",
      "executionMode": "agent_allowed",
      "agentTags": [
        "personal-os",
        "personal-wiki",
        "github-radar",
        "agent-self-improvement"
…
```