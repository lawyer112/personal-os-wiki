# completion-verification
Format: JSON
Top-level: object
Size: 10
Nested depth: 2

## Schema

- task_id: string
- action: string
- verified_by: string
- verified_at: string
- gate_status: string
- evidence_checked: array (3 items)
- findings: array (4 items)
- personal_os_status: string
- personal_os_completed_at: string
- next_recommendation: string

## Preview

```json
{
  "task_id": "cmqq2o6he000u0jmjinvl77a4",
  "action": "completion_verification",
  "verified_by": "obsidianmanager1",
  "verified_at": "2026-06-24T20:45:45Z",
  "gate_status": "pass",
  "evidence_checked": [
    ".agent-runs/cmqq2o6he000u0jmjinvl77a4/skill-evaluation-template-v0.md",
    ".agent-runs/cmqq2o6he000u0jmjinvl77a4/skill-evaluation-report-v0.md",
    ".agent-runs/cmqq2o6he000u0jmjinvl77a4/gate.json"
  ],
  "findings": [
    "Template includes all 8 required fields: candidate, gap, integration, owner, deliverable, definitionOfDone, risk, rejectReason",
    "Report evaluates 8 GitHub candidates with scoring and clear status decisions",
    "Wiki writeback succeeded (intake returned 201, wiki_write_status=ok)",
    "Task submit succeeded (POST /api/tasks/{id}/submit returned 200)"
  ],
  "personal_os_status": "done",
  "personal_os_completed_at": "2026-06-24T20:45:45Z",
  "next_recommendation": "Create agent_allowed task for mnemon-dev/mnemon smoke test as recommended in report"
}

```