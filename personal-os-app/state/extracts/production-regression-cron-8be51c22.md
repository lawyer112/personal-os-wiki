# production-regression-cron
Format: JSON
Top-level: object
Size: 4
Nested depth: 4

## Schema

- checked_at: string
- task_id: string
- status: string
- checks: array (5 items)

## Preview

```json
{
  "checked_at": "2026-06-23T12:22:37.671Z",
  "task_id": "cmqq4eqa800340jmjz1go2euo",
  "status": "pass",
  "checks": [
    {
      "name": "personal-os-context",
      "pass": true,
      "evidence": "artifacts/prod-context-manifest-cron.json"
    },
    {
      "name": "personal-os-task-context",
      "pass": true,
      "evidence": "artifacts/prod-task-context-cron.json"
    },
    {
      "name": "docker-ps-personal-os",
      "pass": true,
      "evidence": "artifacts/prod-docker-ps-cron.log"
    },
    {
      "name": "deployed-manifest-lint",
      "pass": true,
      "evidence": "artifacts/prod-manifest-lint-cron.log"
    },
    {
      "name": "copied-file-sha256-match",
      "pass": true,
      "evidence": [
        "artifacts/deploy-local-sha256-sourcefix.txt",
        "artifacts/deploy-remote-sha256-sourcefix.txt"
      ]
    }
  ]
}
```