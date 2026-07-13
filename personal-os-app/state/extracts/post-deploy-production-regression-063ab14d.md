# post-deploy-production-regression
Format: JSON
Top-level: object
Size: 2
Nested depth: 7

## Schema

- summary: object (9 keys)
- checks: object (4 keys)

## Preview

```json
{
  "summary": {
    "os_context_status": 200,
    "wiki_health_status": 200,
    "os_wiki_page_status": 200,
    "intake_status": 201,
    "intake_ok": true,
    "inbox_id": "cmqqf5x5s00000jo40mvnw42w",
    "agentRunId": "cmqqf5xb500020jo44aayvss4",
    "wiki_write_status": {
      "status": "failed",
      "requested": 1,
      "succeeded": 0,
      "failed": 1,
      "errors": [
        {
          "title": "production-regression-wiki-client-fallback-2026-06-23",
          "error": "frontmatter-parse-error"
        }
      ]
    },
    "wiki_error": null
  },
  "checks": {
    "os_context": {
      "status": 200,
      "body": {
        "ok": true,
        "context": {
          "generatedAt": "2026-06-23T09:05:41.579Z",
          "task": null,
          "searchQueries": [
            "deployment smoke wikiClient read write split"
          ],
          "wiki": {
            "status": "empty",
            "candidates": [],
            "searchedQueries": [
              "deployment smoke wikiClient read write split"
            ],
…
```