# command-results
Format: JSON
Top-level: array
Size: 6
Nested depth: 2

## Schema

- (root) array (6)

## Preview

```json
[
  {
    "name": "manifest-lint",
    "cmd": "node scripts/lint-classic-knowledge-object-manifest.mjs examples/knowledge-objects/*.json",
    "exit_code": 0,
    "started_at": "2026-06-23T16:50:04+08:00",
    "ended_at": "2026-06-23T16:50:04+08:00",
    "evidence": "artifacts/verify-manifest-lint.log"
  },
  {
    "name": "focused-tests",
    "cmd": "npm test -- tests/services/knowledge-manifest.test.ts",
    "exit_code": 0,
    "started_at": "2026-06-23T16:50:04+08:00",
    "ended_at": "2026-06-23T16:50:04+08:00",
    "evidence": "artifacts/verify-focused-tests.log"
  },
  {
    "name": "tsc",
    "cmd": "npx tsc --noEmit",
    "exit_code": 0,
    "started_at": "2026-06-23T16:50:04+08:00",
    "ended_at": "2026-06-23T16:50:05+08:00",
    "evidence": "artifacts/verify-tsc.log"
  },
  {
    "name": "eslint",
    "cmd": "npm run lint",
    "exit_code": 0,
    "started_at": "2026-06-23T16:50:05+08:00",
    "ended_at": "2026-06-23T16:50:08+08:00",
    "evidence": "artifacts/verify-eslint.log"
  },
  {
    "name": "full-tests",
    "cmd": "npm test",
    "exit_code": 0,
    "started_at": "2026-06-23T16:50:08+08:00",
    "ended_at": "2026-06-23T16:50:09+08:00",
    "evidence": "artifacts/verify-full-tests.log"
…
```