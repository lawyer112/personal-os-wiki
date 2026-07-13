# worker-result
Format: JSON
Top-level: object
Size: 7
Nested depth: 2

## Schema

- task_id: string
- agent_id: string
- status: string
- summary: string
- artifacts: array (3 items)
- decision: string
- remaining_risks: array (2 items)

## Preview

```json
{
  "task_id": "cmqyixt4a00n90jpk3todreos",
  "agent_id": "obsidianmanager1",
  "status": "completed",
  "summary": "评估 rohitg00/agentmemory，产出 source ledger、Wiki 评估证据和两个可吸收子任务建议。",
  "artifacts": [
    ".agent-runs/cmqyixt4a00n90jpk3todreos/source-ledger/repos.json",
    ".agent-runs/cmqyixt4a00n90jpk3todreos/source-ledger/evidence.md",
    ".agent-runs/cmqyixt4a00n90jpk3todreos/source-ledger/adoption-tasks.json"
  ],
  "decision": "吸收设计，不直接安装/部署 agentmemory 本体。",
  "remaining_risks": ["外部 benchmark 未本机复现", "若直接启用 memory provider 可能形成双真相源"]
}

```