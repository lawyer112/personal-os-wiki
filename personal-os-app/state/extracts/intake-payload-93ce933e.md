# intake-payload
Format: JSON
Top-level: object
Size: 6
Nested depth: 5

## Schema

- source: object (4 keys)
- agent: object (4 keys)
- project: object (4 keys)
- wikiNotes: array (1 items)
- tasks: array (2 items)
- projectEvents: array (1 items)

## Preview

```json
{
  "source": {
    "sourceType": "agent-output",
    "sourcePlatform": "cron/personal-os-agent-executor",
    "rawText": "Agent task cmqyixt4a00n90jpk3todreos completed: 评估 rohitg00/agentmemory，产出 source ledger、Wiki 评估证据和两个可吸收子任务建议。",
    "createdBy": "hermes"
  },
  "agent": {
    "model": "hermes-cron",
    "classification": {
      "kind": "github-radar-evaluation",
      "task_id": "cmqyixt4a00n90jpk3todreos",
      "repo": "rohitg00/agentmemory"
    },
    "reasoningSummary": "根据 Personal OS P0 agent_allowed 任务，评估外部 agentmemory 项目并抽取可吸收设计。",
    "outputSummary": "评估 rohitg00/agentmemory，产出 source ledger、Wiki 评估证据和两个可吸收子任务建议。"
  },
  "project": {
    "name": "Personal OS / Wiki 知识库升级",
    "status": "active",
    "priority": "P0",
    "currentFocus": "外部 agent memory 方案转成 Personal OS 原生闭环"
  },
  "wikiNotes": [
    {
      "title": "GitHub 雷达评估：rohitg00 agentmemory",
      "frontmatter": {
        "title": "GitHub 雷达评估：rohitg00 agentmemory",
        "type": "source-ledger",
        "created_by": "hermes:worker",
        "source_type": "github-radar",
        "tags": [
          "personal-os",
          "personal-wiki",
          "github-radar",
          "agent-memory",
          "source-ledger"
        ],
        "created_at": "2026-06-30T01:54:56.624Z",
        "task_id": "cmqyixt4a00n90jpk3todreos",
…
```