# prod-fallback-regression
Format: JSON
Top-level: object
Size: 7
Nested depth: 4

## Schema

- stamp: string
- intake_status: number
- ok: boolean
- agentRunId: string
- wiki_write_status: object (5 keys)
- created_task_id: string
- created_task_wiki_links: array (0 items)

## Preview

```json
{
  "stamp": "20260623T095455Z",
  "intake_status": 201,
  "ok": true,
  "agentRunId": "cmqqgx8kr000d0jo5oinikuhf",
  "wiki_write_status": {
    "status": "failed",
    "requested": 1,
    "succeeded": 0,
    "failed": 1,
    "errors": [
      {
        "title": "生产回归 Wiki failure fallback 20260623T095455Z",
        "error": "fetch failed"
      }
    ]
  },
  "created_task_id": "cmqqgx8wi000g0jo5ru0m8x29",
  "created_task_wiki_links": []
}
```