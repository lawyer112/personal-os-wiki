# gate
Format: JSON
Top-level: object
Size: 6
Nested depth: 3

## Schema

- task_id: string
- checked_at: string
- status: string
- checks: array (6 items)
- synthesizer: object (1 keys)
- remaining_risk: string

## Preview

```json
{
  "task_id": "swarmvault-absorb-eval",
  "checked_at": "2026-07-02T22:05:00Z",
  "status": "pass",
  "checks": [
    {"name": "worker-result.json written", "result": "pass"},
    {"name": "evaluation verdict present", "result": "pass", "value": "部分吸收"},
    {"name": "absorb rationale provided", "result": "pass"},
    {"name": "risks documented", "result": "pass"},
    {"name": "no token leak in output", "result": "pass"},
    {"name": "recommended subtasks reference existing tasks", "result": "pass"}
  ],
  "synthesizer": {
    "allowed_to_announce_done": true
  },
  "remaining_risk": "swarmvault MCP 集成（cmr35vrps011r0jny6w6s9x7m）仍 todo；评估笔记需写回 Wiki note"
}

```