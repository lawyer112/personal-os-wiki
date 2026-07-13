# context-readback
Format: JSON
Top-level: object
Size: 3
Nested depth: 8

## Schema

- httpStatus: number
- ok: boolean
- body: object (2 keys)

## Preview

```json
{
  "httpStatus": 200,
  "ok": true,
  "body": {
    "ok": true,
    "context": {
      "generatedAt": "2026-06-30T19:19:14.365Z",
      "task": null,
      "searchQueries": [
        "cmqyixt4a00n90jpk3todreos"
      ],
      "wiki": {
        "status": "ok",
        "candidates": [
          {
            "title": "AgentRun Context Pack：cmqyixt4a00n90jpk3todreos",
            "path": "vault/20_notes/2026-06-30/agentrun-context-pack-cmqyixt4a00n90jpk3todreos.md",
            "created": "2026-07-01 00:21 CST",
            "created_sort": 1782836486.424501,
            "quality_status": "auto",
            "agent_id": "",
            "task_id": "",
            "source_type": "agent-run-context-pack",
            "source_url": "",
            "source_hash": "d5ec12c3693af4b4",
            "status": "auto",
            "tags": [
              "agent-run",
              "agent-run-context-pack",
              "auto-ingested",
              "context-pack",
              "personal-os",
              "personal-wiki"
            ],
            "concepts": [
              "id: os.personal_wiki"
            ],
            "concept_scores": [
              {
                "label": "id: os.personal_wiki",
…
```