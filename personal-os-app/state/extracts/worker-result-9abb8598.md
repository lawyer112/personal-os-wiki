# worker-result
Format: JSON
Top-level: object
Size: 10
Nested depth: 3

## Schema

- task_id: string
- task_title: string
- agent_id: string
- completed_at: string
- summary: string
- changed_files: array (4 items)
- artifacts: object (10 keys)
- validation: array (8 items)
- deployment: object (5 keys)
- residual_risks: array (2 items)

## Preview

```json
{
  "task_id": "cmqqfucnt001t0jn5vd3wcn3u",
  "task_title": "让 Personal OS wikiNotes 自动补齐 Personal Wiki frontmatter 合约",
  "agent_id": "obsidianmanager1",
  "completed_at": "2026-06-23T09:56:07.384045+00:00",
  "summary": "已让 /api/intake 接受 frontmatter-only wikiNotes，并在写入 Personal Wiki 前自动补齐/白名单化 frontmatter 合约；Wiki 写入失败时仍不阻断 Personal OS task/inbox/agentRun。已部署 6.37 并完成成功写入与 Wiki 不可达降级回归。",
  "changed_files": [
    "personal-os-app/src/lib/validation.ts",
    "personal-os-app/src/lib/wiki-ingest.ts",
    "personal-os-app/tests/services/wiki-ingest.test.ts",
    "personal-os-app/tests/routes/intake-wiki-fallback.test.ts"
  ],
  "artifacts": {
    "diff": "personal-os-app/.agent-runs/cmqqfucnt001t0jn5vd3wcn3u/diff.patch",
    "focused_tests": "personal-os-app/.agent-runs/cmqqfucnt001t0jn5vd3wcn3u/logs/focused-tests.log",
    "tsc": "personal-os-app/.agent-runs/cmqqfucnt001t0jn5vd3wcn3u/logs/tsc.log",
    "lint": "personal-os-app/.agent-runs/cmqqfucnt001t0jn5vd3wcn3u/logs/lint.log",
    "full_tests": "personal-os-app/.agent-runs/cmqqfucnt001t0jn5vd3wcn3u/logs/full-tests.log",
    "build": "personal-os-app/.agent-runs/cmqqfucnt001t0jn5vd3wcn3u/logs/build.log",
    "deploy": "personal-os-app/.agent-runs/cmqqfucnt001t0jn5vd3wcn3u/logs/deploy.log",
    "prod_success": "personal-os-app/.agent-runs/cmqqfucnt001t0jn5vd3wcn3u/artifacts/prod-success-regression.json",
    "prod_fallback": "personal-os-app/.agent-runs/cmqqfucnt001t0jn5vd3wcn3u/artifacts/prod-fallback-regression.json",
    "prod_health_after": "personal-os-app/.agent-runs/cmqqfucnt001t0jn5vd3wcn3u/artifacts/prod-health-after-fallback.json"
  },
  "validation": [
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
…
```