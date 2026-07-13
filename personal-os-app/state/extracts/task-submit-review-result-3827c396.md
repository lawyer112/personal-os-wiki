# task-submit-review-result
Format: JSON
Top-level: object
Size: 7
Nested depth: 3

## Schema

- writeback_intake_status: number
- writeback_agentRunId: string
- writeback_wiki_status: object (5 keys)
- submit_status: number
- review_status: number
- final_task_status: string
- final_completedAt: string

## Preview

```json
{
  "writeback_intake_status": 201,
  "writeback_agentRunId": "cmqqh09v1000n0jo54k8gdrp3",
  "writeback_wiki_status": {
    "status": "ok",
    "requested": 1,
    "succeeded": 1,
    "failed": 0,
    "errors": []
  },
  "submit_status": 200,
  "review_status": 200,
  "final_task_status": "done",
  "final_completedAt": "2026-06-23T09:57:18.356Z"
}

```