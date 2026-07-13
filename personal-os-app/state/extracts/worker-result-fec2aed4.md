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
- artifacts: array (7 items)
- decision: string
- remaining_risks: array (3 items)

## Preview

```json
{
  "task_id": "cmr009fup01bu0jpkb1koq2h2",
  "agent_id": "obsidianmanager1",
  "status": "completed",
  "summary": "实现 scripts/archive-agent-run.mjs v0：读取 .agent-runs/<task-id>/ 的 worker-result、gate、source-ledger/evidence 与日志，生成 AgentRun Context Pack markdown 和 /api/intake payload，并在真实任务 cmqyixt4a00n90jpk3todreos 上完成 live intake 写回。",
  "artifacts": [
    "scripts/archive-agent-run.mjs",
    ".agent-runs/cmr009fup01bu0jpkb1koq2h2/dry-run/context-pack.md",
    ".agent-runs/cmr009fup01bu0jpkb1koq2h2/dry-run/intake-payload.json",
    ".agent-runs/cmr009fup01bu0jpkb1koq2h2/intake-test/intake-result.json",
    ".agent-runs/cmr009fup01bu0jpkb1koq2h2/lint.log",
    ".agent-runs/cmr009fup01bu0jpkb1koq2h2/test.log",
    ".agent-runs/cmr009fup01bu0jpkb1koq2h2/build.log"
  ],
  "decision": "保留为新增归档入口；不替换 Personal OS/Wiki 真相源，只把 AgentRun 产物沉淀为可检索 Wiki context pack。",
  "remaining_risks": [
    "npm run build 因 DATABASE_URL 未加载在构建期 page data collection 失败，属于环境配置阻塞；脚本自身已通过 syntax/lint/test/live intake 验证。",
    "工作树存在本轮外的未提交修改，未执行 git commit，避免混入无关变更。",
    "当前脚本为新增文件，6.37 服务已从同一仓库目录读取；未重启服务，因无需改运行中 Next.js 路由。"
  ]
}

```