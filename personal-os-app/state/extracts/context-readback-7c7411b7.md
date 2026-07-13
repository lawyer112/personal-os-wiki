# context-readback
Format: JSON
Top-level: object
Size: 2
Nested depth: 8

## Schema

- httpStatus: number
- body: object (2 keys)

## Preview

```json
{
  "httpStatus": 200,
  "body": {
    "ok": true,
    "context": {
      "generatedAt": "2026-06-30T22:10:45.526Z",
      "task": null,
      "searchQueries": [
        "cmr009fup01bu0jpkb1koq2h2"
      ],
      "wiki": {
        "status": "ok",
        "candidates": [
          {
            "title": "AgentRun Context Pack 实现记录：cmr009fup01bu0jpkb1koq2h2",
            "path": "vault/20_notes/2026-06-30/agentrun-context-pack-实现记录-cmr009fup01bu0jpkb1koq2h2.md",
            "created": "2026-07-01 00:36 CST",
            "created_sort": 1782837373.157571,
            "quality_status": "auto",
            "agent_id": "",
            "task_id": "",
            "source_type": "agent-output",
            "source_url": "",
            "source_hash": "64ee1bbd21c3b822",
            "status": "auto",
            "tags": [
              "agent-output",
              "agent-run",
              "auto-ingested",
              "context-pack",
              "personal-os",
              "personal-wiki"
            ],
            "concepts": [
              "id: dev.api_integration"
            ],
            "concept_scores": [
              {
                "label": "id: dev.api_integration",
                "score": 0
…
```