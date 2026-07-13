# production-smoke
Format: JSON
Top-level: object
Size: 4
Nested depth: 3

## Schema

- generated_at: string
- scope: string
- personal_os_context: object (4 keys)
- personal_wiki_health: object (4 keys)

## Preview

```json
{
  "generated_at": "2026-06-23T16:20:40+08:00",
  "scope": "read-only production smoke; no deploy/restart/database write",
  "personal_os_context": {
    "ok": true,
    "status": 200,
    "keys": [
      "context",
      "ok"
    ],
    "sample": {
      "ok": true
    }
  },
  "personal_wiki_health": {
    "ok": true,
    "status": 200,
    "keys": [
      "data_dir",
      "notes",
      "status"
    ],
    "sample": {
      "status": "ok",
      "notes": 99
    }
  }
}

```