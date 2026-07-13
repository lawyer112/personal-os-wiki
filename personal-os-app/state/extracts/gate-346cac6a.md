# gate
Format: JSON
Top-level: object
Size: 4
Nested depth: 2

## Schema

- task_id: string
- status: string
- checks: object (4 keys)
- synthesizer: object (1 keys)

## Preview

```json
{
  "task_id": "github-radar-cron",
  "status": "pass",
  "checks": {
    "script_exit_code": 0,
    "personal_os_intake_ok": true,
    "wiki_write_confirmed": true,
    "token_leak_check": "pass"
  },
  "synthesizer": {
    "allowed_to_announce_done": true
  }
}

```