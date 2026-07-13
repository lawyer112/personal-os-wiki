# production-context-before-deploy
Format: JSON
Top-level: object
Size: 6
Nested depth: 2

## Schema

- http_status: number
- ok: boolean
- context_keys: array (8 items)
- has_tiers: boolean
- wiki_status: string
- recent_tasks_count: number

## Preview

```json
{
  "http_status": 200,
  "ok": true,
  "context_keys": [
    "activity",
    "generatedAt",
    "policy",
    "recentTasks",
    "relatedIdeas",
    "searchQueries",
    "task",
    "wiki"
  ],
  "has_tiers": false,
  "wiki_status": "ok",
  "recent_tasks_count": 0
}

```