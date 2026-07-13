# gate
Format: JSON
Top-level: object
Size: 6
Nested depth: 4

## Schema

- task_id: string
- status: string
- verified_at: string
- checks: array (3 items)
- deployment: object (2 keys)
- synthesizer: object (1 keys)

## Preview

```json
{
  "task_id": "cmqyixt4a00n90jpk3todreos",
  "status": "pass",
  "verified_at": "2026-06-30T01:53:10Z",
  "checks": [
    {"name": "npm install", "status": "pass", "log": ".agent-runs/cmqyixt4a00n90jpk3todreos/npm-install.log"},
    {"name": "npm run lint", "status": "pass", "log": ".agent-runs/cmqyixt4a00n90jpk3todreos/lint.log"},
    {"name": "artifact files", "status": "pass", "files": [".agent-runs/cmqyixt4a00n90jpk3todreos/worker-result.json", ".agent-runs/cmqyixt4a00n90jpk3todreos/gate.json", ".agent-runs/cmqyixt4a00n90jpk3todreos/source-ledger/repos.json", ".agent-runs/cmqyixt4a00n90jpk3todreos/source-ledger/evidence.md", ".agent-runs/cmqyixt4a00n90jpk3todreos/source-ledger/adoption-tasks.json"]}
  ],
  "deployment": {"status": "not_needed", "reason": "本轮为 Wiki/source-ledger 评估，无代码改动"},
  "synthesizer": {"allowed_to_announce_done": true}
}

```