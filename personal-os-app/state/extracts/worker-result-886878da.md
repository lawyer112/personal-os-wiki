# worker-result
Format: JSON
Top-level: object
Size: 10
Nested depth: 3

## Schema

- task_id: string
- status: string
- summary: string
- changed_files: array (8 items)
- commands: array (5 items)
- diff_path: string
- tests_path: string
- artifacts: array (8 items)
- risks: array (2 items)
- production_regression_record: string

## Preview

```json
{
  "task_id": "cmqqb0d7h00050jnsh6q221l1",
  "status": "done",
  "summary": "实现 wikiClient read/write 分离：read 只允许 GET/HEAD 且使用 WIKI_READ_TOKEN；write 只允许 POST/PUT/PATCH/DELETE 且使用 WIKI_API_TOKEN；/api/intake 在 Wiki 写入失败时仍返回 201，并在响应与 AgentRun classification 中记录 wiki_write_status。",
  "changed_files": [
    "src/app/api/intake/route.ts",
    "src/app/wiki/page.tsx",
    "src/lib/wiki-client.ts",
    "src/lib/wiki-ingest.ts",
    "vitest.config.ts",
    "tests/routes/intake-wiki-fallback.test.ts",
    "tests/services/wiki-client.test.ts",
    "tests/services/wiki-ingest.test.ts"
  ],
  "commands": [
    {
      "cmd": "npm test -- tests/services/wiki-client.test.ts tests/services/wiki-ingest.test.ts tests/routes/intake-wiki-fallback.test.ts",
      "exit_code": 0,
      "started_at": "2026-06-23T16:19:47+08:00",
      "ended_at": "2026-06-23T16:19:48+08:00",
      "evidence": "artifacts/verify-focused-tests.log"
    },
    {
      "cmd": "npx tsc --noEmit",
      "exit_code": 0,
      "started_at": "2026-06-23T16:19:48+08:00",
      "ended_at": "2026-06-23T16:19:50+08:00",
      "evidence": "artifacts/verify-tsc.log"
    },
    {
      "cmd": "npm run lint",
      "exit_code": 0,
      "started_at": "2026-06-23T16:19:50+08:00",
      "ended_at": "2026-06-23T16:19:52+08:00",
      "evidence": "artifacts/verify-lint.log"
    },
    {
      "cmd": "npm test",
      "exit_code": 0,
      "started_at": "2026-06-23T16:19:52+08:00",
…
```