# gate
Format: JSON
Top-level: object
Size: 10
Nested depth: 3

## Schema

- taskId: string
- timestamp: string
- status: string
- verifiedBy: string
- checks: array (9 items)
- synthesizer: object (2 keys)
- deployment: object (5 keys)
- artifacts: array (11 items)
- followUpTask: object (3 keys)
- updatedAt: string

## Preview

```json
{
  "taskId": "cmqq2o6gt000s0jmjpc2aqnbp",
  "timestamp": "2026-06-23T09:23:56.139217+00:00",
  "status": "pass",
  "verifiedBy": "obsidianmanager1",
  "checks": [
    {
      "name": "focused intake/wiki fallback tests",
      "command": "npm test -- --run tests/routes/intake-wiki-fallback.test.ts tests/services/wiki-ingest.test.ts tests/services/wiki-client.test.ts",
      "status": "pass",
      "evidence": "artifacts/predeploy-focused-tests.log; 3 files / 7 tests passed"
    },
    {
      "name": "full vitest suite",
      "command": "npm test",
      "status": "pass",
      "evidence": "artifacts/predeploy-full-tests.log; 18 files / 67 tests passed (includes current manifest tests present in worktree)"
    },
    {
      "name": "eslint",
      "command": "npm run lint",
      "status": "pass",
      "evidence": "artifacts/predeploy-lint.log; exit 0"
    },
    {
      "name": "next build / typecheck",
      "command": "DATABASE_URL=postgresql://user:***@localhost:5432/personal_os_build_dummy npm run build",
      "status": "pass",
      "evidence": "artifacts/predeploy-build-with-dummy-db.log; Next build and TypeScript passed"
    },
    {
      "name": "6.37 backup and file copy",
      "command": "backup to /data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260623-171651/ and rsync exact file list",
      "status": "pass",
      "evidence": "artifacts/deploy-6.37-20260623-171651.log"
    },
    {
      "name": "6.37 docker build",
      "command": "docker compose -p personal-os-wiki-main build personal-os",
      "status": "pass",
…
```