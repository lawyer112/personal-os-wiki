# gate
Format: JSON
Top-level: object
Size: 11
Nested depth: 3

## Schema

- schema_version: string
- task_id: string
- agent_id: string
- status: string
- definition_of_done_met: boolean
- definition_of_done: string
- checks: array (13 items)
- artifacts: array (9 items)
- deployment: object (5 keys)
- synthesizer: object (1 keys)
- remaining_risk: array (2 items)

## Preview

```json
{
  "schema_version": "personal-os-agent-gate-v0",
  "task_id": "cmqq2o6lz000w0jmj9mfh4cer",
  "agent_id": "obsidianmanager1",
  "status": "pass",
  "definition_of_done_met": true,
  "definition_of_done": "能用 3 个样例文件说明 ingest、skip、update 三种路径。",
  "checks": [
    {
      "name": "Personal OS context fetched first",
      "status": "pass",
      "evidence": "/api/agent/context?q=agent executable tasks personal os wiki github radar returned 200"
    },
    {
      "name": "task claimed",
      "status": "pass",
      "evidence": "/api/tasks/cmqq2o6lz000w0jmj9mfh4cer/claim returned doing ownerAgent=obsidianmanager1"
    },
    {
      "name": "three-path simulation",
      "status": "pass",
      "command": "node .agent-runs/cmqq2o6lz000w0jmj9mfh4cer/scripts/simulate-raw-manifest-ingest.mjs",
      "evidence": "counts={ingest:1, skip:1, update:1}"
    },
    {
      "name": "script syntax",
      "status": "pass",
      "command": "node --check .agent-runs/cmqq2o6lz000w0jmj9mfh4cer/scripts/simulate-raw-manifest-ingest.mjs"
    },
    {
      "name": "schema parse",
      "status": "pass",
      "command": "python3 -m json.tool .agent-runs/cmqq2o6lz000w0jmj9mfh4cer/schema/raw-source-manifest.schema.json"
    },
    {
      "name": "decision assertions",
      "status": "pass",
      "command": "node inline assertions over examples/decisions.json"
    },
    {
…
```