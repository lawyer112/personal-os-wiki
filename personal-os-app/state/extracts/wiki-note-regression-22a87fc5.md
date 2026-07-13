# wiki-note-regression
Format: JSON
Top-level: object
Size: 6
Nested depth: 3

## Schema

- status: number
- path: string
- title: string
- frontmatter: object (6 keys)
- contains_task_id: boolean
- content_length: number

## Preview

```json
{
  "status": 200,
  "path": "vault/30_projects/Personal-OS-Wiki-知识库升级/_raw-manifest-增量入库试验-v0-2026-06-23.md",
  "title": "_raw + manifest 增量入库试验 v0 — 2026-06-23",
  "frontmatter": {
    "created_by": "hermes:worker",
    "source_type": "agent-output",
    "task_id": "cmqq2o6lz000w0jmj9mfh4cer",
    "agent_id": "obsidianmanager1",
    "project": "Personal OS / Wiki 知识库升级",
    "tags": [
      "personal-os",
      "personal-wiki",
      "manifest",
      "raw",
      "agent-output"
    ]
  },
  "contains_task_id": true,
  "content_length": 5425
}

```