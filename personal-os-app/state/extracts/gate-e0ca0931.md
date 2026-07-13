# gate
Format: JSON
Top-level: object
Size: 8
Nested depth: 4

## Schema

- task_id: string
- status: string
- reviewer: object (3 keys)
- verifier: object (3 keys)
- deployment: object (5 keys)
- production_regression: object (3 keys)
- writeback: object (2 keys)
- synthesizer: object (3 keys)

## Preview

```json
{
  "task_id": "cmqq4eqa800340jmjz1go2euo",
  "status": "pass",
  "reviewer": {
    "status": "pass",
    "findings": [],
    "notes": "本轮复核发现 examples 的 source_path 在 6.37 不可解析，已补 repo 内 source excerpt 并重算 sha256；本地验证、部署、生产回归均通过。"
  },
  "verifier": {
    "status": "pass",
    "commands": [
      {
        "cmd": "node scripts/lint-classic-knowledge-object-manifest.mjs examples/knowledge-objects/*.json",
        "exit_code": 0,
        "evidence": "artifacts/verify-manifest-lint-sourcefix.log"
      },
      {
        "cmd": "npm test -- tests/services/knowledge-manifest.test.ts",
        "exit_code": 0,
        "evidence": "artifacts/verify-knowledge-manifest-test-sourcefix.log"
      },
      {
        "cmd": "npx tsc --noEmit",
        "exit_code": 0,
        "evidence": "artifacts/verify-tsc-sourcefix.log"
      },
      {
        "cmd": "npm run lint",
        "exit_code": 0,
        "evidence": "artifacts/verify-eslint-sourcefix.log"
      },
      {
        "cmd": "npm test",
        "exit_code": 0,
        "evidence": "artifacts/verify-full-tests-sourcefix.log"
      },
      {
        "cmd": "DATABASE_URL=<dummy> npm run build",
        "exit_code": 0,
        "evidence": "artifacts/verify-build-sourcefix.log"
…
```