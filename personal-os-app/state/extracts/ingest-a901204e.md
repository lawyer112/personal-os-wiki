# ingest
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
- source_url: null
- source_type: string
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
- source_path: string
- hash: object (2 keys)

## Preview

```json
{
  "schema_version": "classic-knowledge-object-manifest/v0",
  "id": "task:raw-ingest-fixture-ingest",
  "type": "task",
  "title": "Ingest fixture new",
  "summary": "New object to be ingested.",
  "source_url": null,
  "source_type": "agent-output",
  "freshness": {
    "status": "fresh",
    "captured_at": "2026-06-23T23:08:33.177571+08:00",
    "valid_until": "2026-07-23T23:08:33.177571+08:00",
    "ttl_days": 30,
    "last_checked_at": "2026-06-23T23:08:33.177571+08:00",
    "stale_reason": null
  },
  "sensitivity": {
    "level": "private",
    "contains_secrets": false,
    "allowed_uses": [
      "agent_context",
      "wiki_index",
      "task_execution"
    ],
    "handling_notes": "Test fixture."
  },
  "owner": {
    "type": "agent",
    "id": "obsidianmanager1"
  },
  "created_at": "2026-06-23T23:08:33.177571+08:00",
  "updated_at": "2026-06-23T23:08:33.177571+08:00",
  "confidence": "verified",
  "lifecycle": {
    "status": "active",
    "review_policy": "classic_review_required",
    "reviewed_at": null,
    "reviewed_by": null
  },
  "relationships": {
…
```