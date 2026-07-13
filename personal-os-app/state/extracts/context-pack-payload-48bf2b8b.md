# context-pack-payload
Format: JSON
Top-level: object
Size: 5
Nested depth: 5

## Schema

- source: object (4 keys)
- agent: object (4 keys)
- project: object (4 keys)
- wikiNotes: array (1 items)
- projectEvents: array (1 items)

## Preview

```json
{
  "source": {
    "sourceType": "agent-output",
    "sourcePlatform": "cron/context-pack",
    "rawText": "AgentRun context pack archived for cmqqb0d7h00050jnsh6q221l1 by cmqqfl6rk00090jn58kastmq9.",
    "createdBy": "hermes"
  },
  "agent": {
    "model": "hermes-context-pack-archiver",
    "classification": {
      "kind": "agent-run-context-pack",
      "task_id": "cmqqfl6rk00090jn58kastmq9",
      "archived_task_id": "cmqqb0d7h00050jnsh6q221l1"
    },
    "reasoningSummary": "将 .agent-runs 目录中的 gate、worker-result、diff、测试、部署和残余风险压缩成可检索 Wiki context pack。",
    "outputSummary": "已生成 cmqqb0d7h00050jnsh6q221l1 的 AgentRun context pack。"
  },
  "project": {
    "name": "Personal OS / Wiki 知识库升级",
    "status": "active",
    "priority": "P0",
    "currentFocus": "Personal OS / Wiki 自驱闭环生产化"
  },
  "wikiNotes": [
    {
      "frontmatter": {
        "title": "AgentRun context pack cmqqb0d7h00050jnsh6q221l1 2026-06-23",
        "type": "project",
        "created_by": "hermes:worker",
        "source_type": "agent-output",
        "tags": [
          "personal-os",
          "personal-wiki",
          "agent-run",
          "context-pack",
          "evidence"
        ],
        "created_at": "2026-06-23T11:18:02.878Z",
        "task_id": "cmqqb0d7h00050jnsh6q221l1",
        "agent_id": "obsidianmanager1",
…
```