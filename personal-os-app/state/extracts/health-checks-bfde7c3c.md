# health-checks
Format: JSON
Top-level: object
Size: 7
Nested depth: 5

## Schema

- generated_at: string
- task_id: string
- manuals: object (4 keys)
- personal_os: object (7 keys)
- personal_wiki: object (6 keys)
- github_radar: object (5 keys)
- verification: object (6 keys)

## Preview

```json
{
  "generated_at": "2026-06-23T13:20:10.523756+00:00",
  "task_id": "cmqq29yi9000c0jmjcejamrel",
  "manuals": {
    "Agent 使用手册：赚钱导向个人知识库": {
      "ok": true,
      "status": 200,
      "matches": [
        "Personal Wiki Mirror",
        "Agent 使用手册：赚钱导向个人知识库",
        "Agent 使用手册：赚钱导向个人知识库"
      ]
    },
    "赚钱任务推定协议": {
      "ok": true,
      "status": 200,
      "matches": [
        "Personal Wiki Mirror",
        "赚钱任务推定协议",
        "Agent 使用手册：赚钱导向个人知识库",
        "Agent 使用手册：赚钱导向个人知识库",
        "赚钱任务推定协议"
      ]
    },
    "Personal OS / 提醒事项 / Wiki 分工规则": {
      "ok": true,
      "status": 200,
      "matches": [
        "Personal OS / 提醒事项 / Wiki 分工规则",
        "Agent 使用手册：赚钱导向个人知识库",
        "Agent 使用手册：赚钱导向个人知识库",
        "Personal OS / 提醒事项 / Wiki 分工规则"
      ]
    },
    "Personal OS Agent 写入凭据交接说明": {
      "ok": true,
      "status": 200,
      "matches": [
        "Personal Wiki Mirror",
        "Personal OS Agent 写入凭据交接说明",
…
```