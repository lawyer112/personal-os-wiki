# decision.classic-knowledge-object
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
  "id": "decision:personal-os-wiki-no-tool-migration-20260623",
  "type": "decision",
  "title": "Personal OS / Wiki 不迁移工具，只吸收可复用模式",
  "summary": "多模型会议决定不迁移到 OpenDeepWiki、Basic Memory、Mem0 或 GraphRAG 全量方案；优先吸收 manifest、context-pack、hybrid retrieval、memory promotion gate、freshness lint、self-improving skill patch flow。",
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
    "handling_notes": "Internal project decision; cite source before using in public docs."
  },
  "owner": {
    "type": "classic",
    "id": "classic"
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