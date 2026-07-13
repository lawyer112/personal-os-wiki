# gate
Format: JSON
Top-level: object
Size: 5
Nested depth: 4

## Schema

- task_id: string
- status: string
- reviewer: object (3 keys)
- verifier: object (3 keys)
- synthesizer: object (3 keys)

## Preview

```json
{
  "task_id": "hermes-e2e-os-canary",
  "status": "pass",
  "reviewer": {
    "status": "pass",
    "findings": [],
    "notes": "Automated gate checked lane exit code, captured diff, and recorded changed files."
  },
  "verifier": {
    "status": "pass",
    "commands": [
      {
        "cmd": "rg '^E2E_CANARY=personal-os-roundtrip$' README.md && git diff -- README.md | rg 'E2E_CANARY=personal-os-roundtrip'",
        "exit_code": 0,
        "evidence": "artifacts/verify-1.log",
        "timed_out": false
      }
    ],
    "screenshots": []
  },
  "synthesizer": {
    "allowed_to_announce_done": true,
    "final_message_path": "final.md",
    "reason": "worker and verifier passed"
  }
}

```