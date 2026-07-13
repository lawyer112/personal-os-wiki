# worker-result
Format: JSON
Top-level: object
Size: 13
Nested depth: 3

## Schema

- task_id: string
- agent_id: string
- status: string
- started_at: string
- ended_at: string
- summary: string
- changed_files: array (8 items)
- diff_path: string
- commands: array (8 items)
- deployment: object (7 keys)
- wiki_writeback: object (2 keys)
- risks: array (2 items)
- next_recommendation: string

## Preview

```json
{
  "task_id": "cmqq4eqa800340jmjz1go2euo",
  "agent_id": "obsidianmanager1",
  "status": "done_deployed",
  "started_at": "2026-06-23T11:56:23Z",
  "ended_at": "2026-06-23T12:26:50Z",
  "summary": "复核并补强 Classic Knowledge Object Manifest v0：保留 schema、3 个样例对象、lint 脚本、文档和 Vitest 测试；新增 repo 内可移植 source excerpt，修复 6.37 上 source_path 不可解析导致部署后 lint 失败的问题；重新跑本地验证、备份并部署到 6.37，生产回归通过。",
  "changed_files": [
    "schemas/classic-knowledge-object-manifest.schema.json",
    "docs/sources/personal-os-evolution-council-report-v1-excerpt.md",
    "examples/knowledge-objects/task.classic-knowledge-object.json",
    "examples/knowledge-objects/decision.classic-knowledge-object.json",
    "examples/knowledge-objects/sop.classic-knowledge-object.json",
    "scripts/lint-classic-knowledge-object-manifest.mjs",
    "docs/CLASSIC_KNOWLEDGE_OBJECT_MANIFEST.md",
    "tests/services/knowledge-manifest.test.ts"
  ],
  "diff_path": "diff.patch",
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
…
```