# decisions
Format: JSON
Top-level: object
Size: 5
Nested depth: 3

## Schema

- ok: boolean
- task_id: string
- decisions: array (3 items)
- counts: object (3 keys)
- outputs: object (3 keys)

## Preview

```json
{
  "ok": true,
  "task_id": "cmqq2o6lz000w0jmj9mfh4cer",
  "decisions": [
    {
      "file": "new-agent-run.md",
      "source_id": "agent-run:cmqq-sample-new",
      "decision": "ingest",
      "reason": "new source_id and new hash"
    },
    {
      "file": "duplicate-existing.md",
      "source_id": "telegram:msg-001",
      "decision": "skip",
      "reason": "same hash already ingested"
    },
    {
      "file": "update-project-readme.md",
      "source_id": "file:project-readme",
      "decision": "update",
      "reason": "same source_id with changed hash"
    }
  ],
  "counts": {
    "ingest": 1,
    "skip": 1,
    "update": 1
  },
  "outputs": {
    "before": "examples/manifest.before.json",
    "after": "examples/manifest.after.json",
    "decisions": "examples/decisions.json"
  }
}

```