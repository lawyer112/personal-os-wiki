# worker-result
Format: JSON
Top-level: object
Size: 14
Nested depth: 3

## Schema

- task_id: string
- agent_id: string
- title: string
- status: string
- started_at: string
- completed_at: string
- selected_reason: string
- work_performed: array (7 items)
- artifacts: object (9 keys)
- verification: array (6 items)
- writeback: object (12 keys)
- deployment: object (3 keys)
- residual_risks: array (2 items)
- next_recommendation: string

## Preview

```json
{
  "task_id": "cmqq2o6lz000w0jmj9mfh4cer",
  "agent_id": "obsidianmanager1",
  "title": "设计 _raw + manifest 增量入库试验",
  "status": "completed",
  "started_at": "2026-06-23T13:42:33.294Z",
  "completed_at": "2026-06-23T13:51:35Z",
  "selected_reason": "P1、agent_allowed、low risk，直接推进 Personal Wiki 入库去重和 OS/Wiki 可追溯闭环。",
  "work_performed": [
    "调用 /api/agent/context?q=agent executable tasks personal os wiki github radar 获取上下文。",
    "查询 /api/agent-inbox 与 /api/tasks，选择 P1 agent_allowed 任务 cmqq2o6lz000w0jmj9mfh4cer。",
    "通过 /api/tasks/cmqq2o6lz000w0jmj9mfh4cer/claim 领取任务。",
    "在 .agent-runs/cmqq2o6lz000w0jmj9mfh4cer/ 下创建 schema、报告、样例、模拟脚本、日志和 diff。",
    "实现 3 个样例：ingest、skip、update，并生成 manifest.before.json、manifest.after.json、decisions.json。",
    "通过 Personal OS /api/intake 写入 Wiki note 与 ProjectEvent。",
    "通过 Personal Wiki /api/note 回读生产 Wiki note，确认 frontmatter 白名单字段和 task_id。"
  ],
  "artifacts": {
    "run_dir": ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer",
    "report": ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer/reports/raw-manifest-ingest-v0.md",
    "schema": ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer/schema/raw-source-manifest.schema.json",
    "script": ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer/scripts/simulate-raw-manifest-ingest.mjs",
    "fixtures": [
      ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer/examples/raw/new-agent-run.md",
      ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer/examples/raw/duplicate-existing.md",
      ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer/examples/raw/update-project-readme.md"
    ],
    "outputs": [
      ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer/examples/manifest.before.json",
      ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer/examples/manifest.after.json",
      ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer/examples/decisions.json"
    ],
    "logs": [
      ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer/logs/simulate-raw-manifest-ingest.pass.log",
      ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer/logs/verification-targeted.log",
      ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer/logs/eslint-targeted-script-only.log",
      ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer/logs/wiki-note-regression.json"
    ],
    "diff": ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer/diff/agent-run-files.diff",
    "artifact_hashes": ".agent-runs/cmqq2o6lz000w0jmj9mfh4cer/logs/artifact-sha256.json"
…
```