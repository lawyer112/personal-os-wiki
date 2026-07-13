# worker-result
Format: JSON
Top-level: object
Size: 7
Nested depth: 2

## Schema

- task_id: string
- ran_at: string
- script: string
- args: array (3 items)
- result: object (9 keys)
- out_dir: string
- artifacts: array (5 items)

## Preview

```json
{
  "task_id": "cmr23a5v6005l0jnyxujhw83y",
  "ran_at": "2026-07-02T10:02:43.778Z",
  "script": "scripts/github-radar-intake.mjs",
  "args": ["--intake", "--limit=8", "--task-id=cmr23a5v6005l0jnyxujhw83y"],
  "result": {
    "repos": 8,
    "new_repos": 0,
    "registry_total": 17,
    "tasks_generated": 1,
    "tasks_deduped_out": 4,
    "intake_ok": true,
    "agentRunId": "cmr3c5vys01650jnyguqa3yn7",
    "wiki_write_status": "queued",
    "wiki_job_id": "cmr3c5vyx01680jnyb1wh988s"
  },
  "out_dir": ".agent-runs/github-radar-20260702",
  "artifacts": ["repos.json", "evidence.md", "adoption-tasks.json", "intake-payload.json", "intake-result.json"]
}

```