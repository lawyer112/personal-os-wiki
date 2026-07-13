# worker-result
Format: JSON
Top-level: object
Size: 11
Nested depth: 3

## Schema

- task_id: string
- status: string
- model: string
- started_at: string
- completed_at: string
- summary: string
- changed_files: array (9 items)
- commands: array (6 items)
- risks: array (2 items)
- deployment: object (3 keys)
- writeback: object (5 keys)

## Preview

```json
{
  "task_id": "cmqqqgfgm001r0jocadvkeqzz",
  "status": "completed",
  "model": "kimi-k2.7-code via Hermes",
  "started_at": "2026-06-23T14:58:00.000Z",
  "completed_at": "2026-06-23T15:24:00.000Z",
  "summary": "实现 raw manifest 小样本 ingest 命令 v0：新增 scripts/raw-manifest-ingest.mjs CLI 工具，支持显式目录传入、dry-run 默认、registry 状态追踪（ingest/skip/update），构建 /api/intake payload 和 --intake 真实写入。复用 lint-classic-knowledge-object-manifest.mjs 做前置验证。产出 3 个 fixture 和 targeted test，dry-run 稳定产出 ingest=1、skip=1、update=1。",
  "changed_files": [
    "scripts/raw-manifest-ingest.mjs",
    "tests/services/raw-manifest-ingest.test.ts",
    "tests/fixtures/raw-manifest-ingest/ingest.json",
    "tests/fixtures/raw-manifest-ingest/ingest-source.md",
    "tests/fixtures/raw-manifest-ingest/skip.json",
    "tests/fixtures/raw-manifest-ingest/skip-source.md",
    "tests/fixtures/raw-manifest-ingest/update.json",
    "tests/fixtures/raw-manifest-ingest/update-source.md",
    "tests/fixtures/raw-manifest-ingest/.raw-manifest-registry.json"
  ],
  "commands": [
    { "cmd": "node --check scripts/raw-manifest-ingest.mjs", "exit_code": 0, "evidence": ".agent-runs/cmqqqgfgm001r0jocadvkeqzz/gate.json" },
    { "cmd": "npx eslint scripts/raw-manifest-ingest.mjs", "exit_code": 0, "evidence": ".agent-runs/cmqqqgfgm001r0jocadvkeqzz/gate.json" },
    { "cmd": "npx vitest run tests/services/raw-manifest-ingest.test.ts", "exit_code": 0, "evidence": ".agent-runs/cmqqqgfgm001r0jocadvkeqzz/gate.json" },
    { "cmd": "node scripts/raw-manifest-ingest.mjs --dir=tests/fixtures/raw-manifest-ingest --dry-run", "exit_code": 0, "evidence": ".agent-runs/cmqqqgfgm001r0jocadvkeqzz/dry-run.log" },
    { "cmd": "npx tsc --noEmit", "exit_code": 0, "evidence": ".agent-runs/cmqqqgfgm001r0jocadvkeqzz/gate.json" },
    { "cmd": "npx vitest run", "exit_code": 0, "evidence": ".agent-runs/cmqqqgfgm001r0jocadvkeqzz/gate.json" }
  ],
  "risks": [
    "--intake 模式未在测试中模拟 fetch，也未用单条测试 note 回读验证真实 /api/intake；如需接入生产，建议补充 mock intake 测试或小规模生产验证。",
    "lint-classic-knowledge-object-manifest.mjs 导出的 lintFiles 被跳过了 .raw-manifest-registry.json，但未过滤其他非 manifest 文件；如果目录内有其他 .json，可能被误当成 manifest。"
  ],
  "deployment": {
    "status": "not_applicable",
    "backup_dir": null,
    "rollback_path": null
  },
  "writeback": {
    "status": "ok",
    "definitionOfDoneMet": true,
    "task_status_after_review": "complete",
    "personal_os_intake": "cmqqsouv400200joc33pftaly",
…
```