# gate
Format: JSON
Top-level: object
Size: 5
Nested depth: 3

## Schema

- status: string
- verifier: string
- verifiedAt: string
- checks: array (4 items)
- synthesizer: object (2 keys)

## Preview

```json
{
  "status": "pass",
  "verifier": "obsidianmanager1",
  "verifiedAt": "2026-06-24T01:02:31Z",
  "checks": [
    {
      "name": "tsc",
      "result": "pass",
      "evidence": "npx tsc --noEmit exit_code=0"
    },
    {
      "name": "npm-test",
      "result": "pass",
      "evidence": "78 tests passed across 20 test files"
    },
    {
      "name": "docker-build",
      "result": "pass",
      "evidence": "docker compose -p personal-os-wiki-main build personal-os succeeded on 6.37"
    },
    {
      "name": "prod-regression",
      "result": "pass",
      "evidence": "POST /api/intake with frontmatter wikiNotes returned wiki_write_status=ok, Wiki note created at 30_projects/Personal-OS-Wiki-..."
    }
  ],
  "synthesizer": {
    "allowed_to_announce_done": true,
    "reason": "All checks passed. The fix is a single schema addition that is backward compatible and does not affect existing functionality."
  }
}
```