# production-regression-followup
Format: JSON
Top-level: object
Size: 4
Nested depth: 4

## Schema

- startedAt: string
- actions: array (5 items)
- finishedAt: string
- status: string

## Preview

```json
{
  "startedAt": "2026-06-23T09:20:35.066633+00:00",
  "actions": [
    {
      "name": "patch archive canary task",
      "ok": true,
      "status": 200,
      "task": {
        "id": "cmqqfmeyq000k0jn5psedj7td",
        "title": "[archived-canary] /api/intake wikiNotes+task production regression 20260623-091830",
        "status": "archived",
        "submittedAt": null
      }
    },
    {
      "name": "direct personal-wiki ingest deployment record",
      "ok": false,
      "status": 400,
      "error": "frontmatter-parse-error"
    },
    {
      "name": "verify wiki deployment record searchable",
      "ok": true,
      "status": 200,
      "notesCount": 0,
      "firstNote": null
    },
    {
      "name": "verify original task done",
      "ok": true,
      "status": 200,
      "task": {
        "id": "cmqq2o6gt000s0jmjpc2aqnbp",
        "title": "准备 /api/intake 带 wikiNotes 500 的本地补丁和回归测试",
        "status": "done",
        "submittedAt": "2026-06-23T07:29:15.930Z"
      }
    },
    {
      "name": "verify canary task archived",
…
```