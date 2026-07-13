# production-regression
Format: JSON
Top-level: object
Size: 4
Nested depth: 6

## Schema

- startedAt: string
- checks: array (7 items)
- finishedAt: string
- status: string

## Preview

```json
{
  "startedAt": "2026-06-23T09:18:30.529264+00:00",
  "checks": [
    {
      "name": "personal-os context readiness attempt 1",
      "ok": true,
      "status": 200,
      "jsonSummary": {
        "ok": true,
        "context": {
          "wikiStatus": "empty",
          "recentTasks": 0,
          "activity": 0,
          "taskStatus": null
        }
      }
    },
    {
      "name": "personal-os tasks read",
      "ok": true,
      "status": 200,
      "jsonSummary": {
        "ok": true,
        "tasksCount": 26
      }
    },
    {
      "name": "personal-wiki health",
      "ok": true,
      "status": 200,
      "jsonSummary": {}
    },
    {
      "name": "production /api/intake wikiNotes+task canary",
      "ok": true,
      "status": 201,
      "jsonSummary": {
        "ok": true,
        "tasksCount": 1,
        "wiki": [
…
```