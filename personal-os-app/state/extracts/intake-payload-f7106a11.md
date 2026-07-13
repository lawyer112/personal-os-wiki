# intake-payload
Format: JSON
Top-level: object
Size: 8
Nested depth: 5

## Schema

- source: object (4 keys)
- agent: object (4 keys)
- project: object (2 keys)
- wikiNotes: array (1 items)
- tasks: array (0 items)
- notes: array (0 items)
- ideas: array (0 items)
- projectEvents: array (1 items)

## Preview

```json
{
  "source": {
    "sourceType": "agent-output",
    "sourcePlatform": "cron/personal-os-agent-executor",
    "rawText": "AgentRun context pack archived for cmqyixt4a00n90jpk3todreos: gate=pass",
    "createdBy": "hermes"
  },
  "agent": {
    "model": "hermes-cron/archive-agent-run",
    "classification": {
      "kind": "agent-run-context-pack",
      "task_id": "cmqyixt4a00n90jpk3todreos",
      "gate_status": "pass"
    },
    "reasoningSummary": "读取 .agent-runs task 产物，生成可检索的 AgentRun context pack。",
    "outputSummary": "已归档 cmqyixt4a00n90jpk3todreos 的 worker-result、gate、验证、部署、残余风险和产物索引。"
  },
  "project": {
    "id": "cmqq290nm00040jmj9jwa98ya",
    "name": "Personal OS / Wiki 知识库升级"
  },
  "wikiNotes": [
    {
      "title": "AgentRun Context Pack：cmqyixt4a00n90jpk3todreos",
      "source_type": "agent-run-context-pack",
      "tags": [
        "personal-os",
        "personal-wiki",
        "agent-run",
        "context-pack"
      ],
      "metadata": {
        "task_id": "cmqyixt4a00n90jpk3todreos",
        "agent_id": "obsidianmanager1",
        "gate_status": "pass",
        "project": "Personal OS / Wiki 知识库升级"
      },
      "frontmatter": {
        "title": "AgentRun Context Pack：cmqyixt4a00n90jpk3todreos",
        "type": "agent-run-context-pack",
…
```