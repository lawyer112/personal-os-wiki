# gate
Format: JSON
Top-level: object
Size: 9
Nested depth: 4

## Schema

- task_id: string
- status: string
- reviewer: object (2 keys)
- verifier: object (3 keys)
- wiki_writeback: object (2 keys)
- deployment: object (2 keys)
- production_regression: object (2 keys)
- synthesizer: object (3 keys)
- writeback: object (3 keys)

## Preview

```json
{
  "task_id": "cmqq2o6he000u0jmjinvl77a4",
  "status": "pass",
  "reviewer": {
    "status": "pass",
    "findings": []
  },
  "verifier": {
    "status": "pass",
    "commands": [
      {
        "cmd": "write skill-evaluation-template-v0.md",
        "exit_code": 0,
        "evidence": ".agent-runs/cmqq2o6he000u0jmjinvl77a4/skill-evaluation-template-v0.md"
      },
      {
        "cmd": "write skill-evaluation-report-v0.md",
        "exit_code": 0,
        "evidence": ".agent-runs/cmqq2o6he000u0jmjinvl77a4/skill-evaluation-report-v0.md"
      },
      {
        "cmd": "POST /api/intake with 2 wikiNotes + projectEvent",
        "exit_code": 201,
        "evidence": "intake response: wiki_write_status=ok, requested=2, succeeded=2"
      },
      {
        "cmd": "POST /api/tasks/cmqq2o6he000u0jmjinvl77a4/submit",
        "exit_code": 200,
        "evidence": "submit response: status=review, contribution created"
      }
    ],
    "screenshots": []
  },
  "wiki_writeback": {
    "status": "pass",
    "evidence": [
      "Wiki note: Skill Evaluation Template v0 (revision)",
      "Wiki note: Skill Evaluation Report v0 — GitHub Radar 2026-06-23 (created)"
    ]
  },
…
```