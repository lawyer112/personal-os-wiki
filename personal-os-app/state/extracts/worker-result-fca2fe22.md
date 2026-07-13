# worker-result
Format: JSON
Top-level: object
Size: 7
Nested depth: 2

## Schema

- lane: string
- model: string
- worker: string
- exit_code: number
- changed_files: array (1 items)
- summary: string
- evidence: array (4 items)

## Preview

```json
{
  "lane": "manual",
  "model": "kimi-k2.7-code",
  "worker": "done",
  "exit_code": 0,
  "changed_files": [
    "scripts/github-radar-intake.mjs"
  ],
  "summary": "Fix github-radar-intake.mjs missing wikiNotes.title field causing /api/intake 400 validation error. Added title to wikiNotes payload. After fix, intake returns 200 ok. Wiki write still fails with frontmatter-parse-error (separate server-side issue). Lint and tests pass.",
  "evidence": [
    "artifacts/intake-result.json",
    "artifacts/diff.patch",
    "artifacts/npm-test.log",
    "artifacts/npm-lint.log"
  ]
}

```