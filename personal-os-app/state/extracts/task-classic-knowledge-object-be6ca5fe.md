# task.classic-knowledge-object
Format: JSON
Top-level: object
Size: 20
Nested depth: 3

## Schema

- schema_version: string
- id: string
- type: string
- title: string
- summary: string
- source_path: string
- source_url: null
- source_type: string
- hash: object (2 keys)
- freshness: object (6 keys)
- sensitivity: object (4 keys)
- owner: object (2 keys)
- created_at: string
- updated_at: string
- confidence: string
- lifecycle: object (4 keys)
- relationships: object (6 keys)
- embedding: object (3 keys)
- content: object (3 keys)
- lint: object (1 keys)

## Preview

```json
{
  "schema_version": "classic-knowledge-object-manifest/v0",
  "id": "task:cmqq4eqa800340jmjz1go2euo",
  "type": "task",
  "title": "定义 Classic Knowledge Object Manifest v0",
  "summary": "为 Personal OS / Wiki 知识对象定义可追溯的 manifest schema，要求任务、项目、证据、决策、SOP、Hub 都具备 source_path、hash、freshness、sensitivity 等字段。",
  "source_path": "docs/sources/personal-os-evolution-council-report-v1-excerpt.md",
  "source_url": null,
  "source_type": "agent-output",
  "hash": {
    "algorithm": "sha256",
    "value": "f36131f5b3214688b6756603d5190b3d64cbb6e76b9a6615a7b9f921816dc6c3"
  },
  "freshness": {
    "status": "fresh",
    "captured_at": "2026-06-23T12:03:08+08:00",
    "valid_until": "2026-09-21T00:00:00+08:00",
    "ttl_days": 90,
    "last_checked_at": "2026-06-23T16:40:00+08:00",
    "stale_reason": null
  },
  "sensitivity": {
    "level": "private",
    "contains_secrets": false,
    "allowed_uses": ["agent_context", "wiki_index", "task_execution"],
    "handling_notes": "Local Classic project metadata; do not publish without review."
  },
  "owner": {
    "type": "agent",
    "id": "hermes"
  },
  "created_at": "2026-06-23T12:03:08+08:00",
  "updated_at": "2026-06-23T16:40:00+08:00",
  "confidence": "verified",
  "lifecycle": {
    "status": "active",
    "review_policy": "classic_review_required",
    "reviewed_at": null,
    "reviewed_by": null
  },
…
```