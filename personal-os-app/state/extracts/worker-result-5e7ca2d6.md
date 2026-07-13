# worker-result
Format: JSON
Top-level: object
Size: 10
Nested depth: 2

## Schema

- taskId: string
- agentId: string
- startedAt: string
- completedAt: string
- status: string
- summary: string
- artifacts: array (4 items)
- changed_files: array (0 items)
- risks: array (1 items)
- nextRecommendation: string

## Preview

```json
{
  "taskId": "cmqqxals8000f0jpj7dgqj12m",
  "agentId": "obsidianmanager1",
  "startedAt": "2026-06-24T03:45:00.000Z",
  "completedAt": "2026-06-24T03:52:00.000Z",
  "status": "completed",
  "summary": "验证 AgentRun context pack 自动归档脚本 archive-agent-run-context-pack.mjs 对已归档任务 cmqq29yi9000c0jmjcejamrel 重新运行归档，确认 Wiki note 创建成功、Personal OS intake 返回 201、无 token 泄漏。随后在 Personal OS 将本任务标记为 done。",
  "artifacts": [
    "scripts/archive-agent-run-context-pack.mjs",
    ".agent-runs/cmqq29yi9000c0jmjcejamrel/context-pack.md",
    ".agent-runs/cmqq29yi9000c0jmjcejamrel/context-pack-intake-result.json",
    ".agent-runs/cmqq29yi9000c0jmjcejamrel/context-pack-result.json"
  ],
  "changed_files": [],
  "risks": [
    "archive-script 的测试/验证节目前只提取 commands 数组；若 worker-result 没有 commands 则显示 evidence incomplete。未来可扩展为从 worker-result.verification 或 gate.checks 提取测试信息。"
  ],
  "nextRecommendation": "将 archive-agent-run-context-pack.mjs 加入 cron，在任务进入 done/review 后自动归档。"
}

```