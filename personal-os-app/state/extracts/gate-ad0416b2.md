# gate
Format: JSON
Top-level: object
Size: 9
Nested depth: 2

## Schema

- task_id: string
- status: string
- synthesizer: object (1 keys)
- checks: object (6 keys)
- dod_met: string
- residual_risk: string
- verified_at: string
- swarmvault_version: string
- node_version: string

## Preview

```json
{
  "task_id": "cmr35vrps011r0jny6w6s9x7m",
  "status": "pass",
  "synthesizer": { "allowed_to_announce_done": true },
  "checks": {
    "node_gte_24": true,
    "swarmvault_installed": true,
    "mcp_stdio_start": true,
    "tools_list_ok": true,
    "graph_status_callable": true,
    "no_token_in_output": true
  },
  "dod_met": "swarmvault mcp 可正常 stdio 启动；graph_status tool 可调用并返回结构化 JSON；tools/list 返回50+工具包括 graph_status 和 context 类工具。",
  "residual_risk": "SwarmVault 尚未指向 personal-os-app 项目目录，graph 为空（stale=true）。下一任务（cmr35vrq6011t0jny68jy2rcz）需要把 MCP 接入 /api/agent/context 时再初始化 project 路径。",
  "verified_at": "2026-07-02T19:06:14.000Z",
  "swarmvault_version": "3.20.0",
  "node_version": "v25.6.1"
}

```