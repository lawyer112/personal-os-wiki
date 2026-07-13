# gate
Format: JSON
Top-level: object
Size: 9
Nested depth: 4

## Schema

- task_id: string
- status: string
- allowed_to_announce_done: boolean
- synthesizer: object (1 keys)
- checks: array (7 items)
- deployment: object (2 keys)
- residual_risk: string
- created_at: string
- updated_at: string

## Preview

```json
{
  "task_id": "cmr006b4p01b90jpk4trb0240",
  "status": "pass",
  "allowed_to_announce_done": true,
  "synthesizer": {
    "allowed_to_announce_done": true
  },
  "checks": [
    {
      "name": "archive-agent-run --intake",
      "status": "pass",
      "log": "/tmp/archive-agent-run-cmr006b4p01b90jpk4trb0240.log",
      "details": "生成 context-pack；Personal OS intake 顶层 ok，项目事件创建；wiki_write_status=failed/aborted 记录为残余风险。"
    },
    {
      "name": "direct Personal Wiki ingest probe",
      "status": "pass",
      "log": ".agent-runs/cmr006b4p01b90jpk4trb0240/artifacts/wiki-ingest-probe.json",
      "details": "HTTP 200 elapsed_ms=31168 note_path parsed from response body."
    },
    {
      "name": "wiki note readback required sections",
      "status": "pass",
      "log": ".agent-runs/cmr006b4p01b90jpk4trb0240/artifacts/wiki-note-readback.json",
      "details": {
        "任务ID：cmqyixt4a00n90jpk3todreos": true,
        "Gate：pass": true,
        "## Diff / 代码改动": true,
        "## 测试 / 构建证据": true,
        "## 部署": true,
        "## 残余风险": true
      }
    },
    {
      "name": "secret scan generated context pack",
      "status": "pass",
      "log": ".agent-runs/cmr006b4p01b90jpk4trb0240/artifacts/secret-scan.json"
    },
    {
      "name": "tsc --noEmit",
…
```