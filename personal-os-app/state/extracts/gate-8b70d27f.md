# gate
Format: JSON
Top-level: object
Size: 4
Nested depth: 4

## Schema

- taskId: string
- gate: object (3 keys)
- synthesizer: object (2 keys)
- timestamp: string

## Preview

```json
{
  "taskId": "cmqq2o6ey000q0jmjcrv03ujr",
  "gate": {
    "status": "pass",
    "verdict": "DefinitionOfDone 已全部满足：Wiki 读接口鉴权正常，context API 返回 Wiki candidates。",
    "checks": [
      {
        "name": "wiki_tags_auth",
        "status": "pass",
        "detail": "WIKI_READ_TOKEN -> /api/tags = 200, 72 tags"
      },
      {
        "name": "wiki_notes_auth",
        "status": "pass",
        "detail": "WIKI_READ_TOKEN -> /api/notes = 200, 20 notes"
      },
      {
        "name": "agent_context_wiki_candidates",
        "status": "pass",
        "detail": "Personal OS /api/agent/context?q=personal+os+wiki returns ok with 2+ wiki candidates"
      }
    ]
  },
  "synthesizer": {
    "allowed_to_announce_done": true,
    "note": "无代码变更，只是验证与状态更新，不需要部署。"
  },
  "timestamp": "2026-06-23T22:08:00Z"
}

```