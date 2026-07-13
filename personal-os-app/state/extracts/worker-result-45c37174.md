# worker-result
Format: JSON
Top-level: object
Size: 6
Nested depth: 2

## Schema

- taskId: string
- status: string
- summary: string
- artifacts: array (2 items)
- commit: string
- deployBackup: string

## Preview

```json
{
  "taskId": "agent-context-evidence-20260624",
  "status": "completed",
  "summary": "完成 /api/agent/context evidence.episodes 支持并部署到 6.37",
  "artifacts": [
    "src/lib/agent-context.ts",
    "tests/services/agent-context.test.ts"
  ],
  "commit": "87d9017",
  "deployBackup": "/data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260623-211132"
}

```