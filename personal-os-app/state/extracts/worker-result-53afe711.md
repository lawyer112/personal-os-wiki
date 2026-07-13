# worker-result
Format: JSON
Top-level: object
Size: 11
Nested depth: 4

## Schema

- task_id: string
- agent_id: string
- status: string
- started_at: string
- ended_at: string
- summary: string
- changed_files: array (2 items)
- commands: array (4 items)
- context_pack: object (2 keys)
- risks: array (3 items)
- writeback: object (5 keys)

## Preview

```json
{
  "task_id": "cmqq2o6he000u0jmjinvl77a4",
  "agent_id": "obsidianmanager1",
  "status": "completed",
  "started_at": "2026-06-23T16:57:16.028Z",
  "ended_at": "2026-06-23T16:57:16.267Z",
  "summary": "Produced skill-evaluation-template-v0.md and skill-evaluation-report-v0.md. Template defines 8 evaluation fields and a scoring quick reference. Report applied the template to 8 GitHub radar candidates from 2026-06-23, concluding: 2 absorbed, 3 reference-only, 2 rejected, 1 pending Classic decision. Both files were written locally and submitted to Personal OS / Wiki via /api/intake. Wiki write succeeded for 2 notes; projectEvent created; task submitted to review with definitionOfDoneMet=true.",
  "changed_files": [
    ".agent-runs/cmqq2o6he000u0jmjinvl77a4/skill-evaluation-template-v0.md",
    ".agent-runs/cmqq2o6he000u0jmjinvl77a4/skill-evaluation-report-v0.md"
  ],
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
  "context_pack": {
    "wiki_notes": [
      {
        "title": "Skill Evaluation Template v0",
        "status": "revision"
      },
      {
…
```