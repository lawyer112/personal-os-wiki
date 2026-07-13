# current-intake-payload
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
    "rawText": "Agent task cmr009fup01bu0jpkb1koq2h2 completed: implemented archive-agent-run.mjs and wrote live context pack intake.",
    "createdBy": "hermes"
  },
  "agent": {
    "model": "hermes-cron",
    "classification": {
      "kind": "agent-run-context-pack-implementation",
      "task_id": "cmr009fup01bu0jpkb1koq2h2",
      "gate_status": "pass"
    },
    "reasoningSummary": "根据 Personal OS P1 agent_allowed 任务，新增 AgentRun context pack 归档脚本并在真实任务上验证写回。",
    "outputSummary": "实现 archive-agent-run.mjs，dry-run 与 live /api/intake 均成功，lint/test 通过。"
  },
  "project": {
    "id": "cmqq290nm00040jmj9jwa98ya",
    "name": "Personal OS / Wiki 知识库升级"
  },
  "wikiNotes": [
    {
      "title": "AgentRun Context Pack 实现记录：cmr009fup01bu0jpkb1koq2h2",
      "source_type": "agent-output",
      "tags": [
        "personal-os",
        "personal-wiki",
        "agent-run",
        "context-pack"
      ],
      "metadata": {
        "task_id": "cmr009fup01bu0jpkb1koq2h2",
        "agent_id": "obsidianmanager1",
        "gate_status": "pass",
        "project": "Personal OS / Wiki 知识库升级"
      },
      "frontmatter": {
        "title": "AgentRun Context Pack 实现记录：cmr009fup01bu0jpkb1koq2h2",
        "type": "agent-run-context-pack",
…
```