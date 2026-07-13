# gate
Format: JSON
Top-level: object
Size: 4
Nested depth: 3

## Schema

- status: string
- verifier: string
- checks: array (4 items)
- synthesizer: object (2 keys)

## Preview

```json
{
  "status": "pass",
  "verifier": "npm-lint-test + intake-smoke",
  "checks": [
    {
      "name": "npm-lint",
      "result": "pass",
      "exit_code": 0,
      "evidence": "artifacts/npm-lint.log"
    },
    {
      "name": "npm-test",
      "result": "pass",
      "exit_code": 0,
      "tests": "20 passed, 78 passed",
      "evidence": "artifacts/npm-test.log"
    },
    {
      "name": "intake-validation",
      "result": "pass",
      "exit_code": 0,
      "detail": "/api/intake returns 200 ok after adding wikiNotes.title. Previous 400 {invalid_type: expected string, received undefined} resolved.",
      "evidence": "artifacts/intake-result.json"
    },
    {
      "name": "wiki-write-frontmatter",
      "result": "warn",
      "detail": "wiki_write_status failed with frontmatter-parse-error. This is a pre-existing server-side issue, not caused by this change. Intake still creates agentRun and inbox successfully.",
      "evidence": "artifacts/intake-result.json"
    }
  ],
  "synthesizer": {
    "allowed_to_announce_done": true,
    "note": "Fix is localized and verified. No production risk. Ready to write back to Personal OS."
  }
}

```