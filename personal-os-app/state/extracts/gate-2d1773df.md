# gate
Format: JSON
Top-level: object
Size: 9
Nested depth: 3

## Schema

- task_id: string
- status: string
- checked_at: string
- definition_of_done_met: boolean
- checks: array (8 items)
- deployment: object (5 keys)
- synthesizer: object (1 keys)
- rollback: object (2 keys)
- notes: string

## Preview

```json
{
  "task_id": "cmqqfucnt001t0jn5vd3wcn3u",
  "status": "pass",
  "checked_at": "2026-06-23T09:56:07.384473+00:00",
  "definition_of_done_met": true,
  "checks": [
    {
      "command": "npm test -- tests/services/wiki-ingest.test.ts tests/routes/intake-wiki-fallback.test.ts",
      "result": "pass",
      "evidence": "5 tests / 2 files passed"
    },
    {
      "command": "npx tsc --noEmit",
      "result": "pass",
      "evidence": "exit 0"
    },
    {
      "command": "npm run lint",
      "result": "pass",
      "evidence": "exit 0"
    },
    {
      "command": "npm test",
      "result": "pass",
      "evidence": "69 tests / 18 files passed"
    },
    {
      "command": "DATABASE_URL=<dummy> npm run build",
      "result": "pass",
      "evidence": "Next build compiled, TypeScript, static generation passed"
    },
    {
      "command": "docker compose -p personal-os-wiki-main build personal-os && up -d --no-deps personal-os",
      "result": "pass",
      "evidence": "remote image personal-os-app:demo built and container started"
    },
    {
      "command": "production /api/intake frontmatter-only wikiNotes+task",
      "result": "pass",
      "evidence": "201; wiki_write_status=ok; created task has Wiki link"
…
```