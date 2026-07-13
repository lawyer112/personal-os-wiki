# production-regression
Format: JSON
Top-level: object
Size: 11
Nested depth: 2

## Schema

- root_http_status: number
- wiki_health_status: number
- query_context_http_status: number
- query_context_has_tiers: boolean
- query_context_tier_counts: object (3 keys)
- query_context_hot_has_agent_task: boolean
- task_context_http_status: number
- task_context_has_tiers: boolean
- task_context_hot_current_task: boolean
- compat_fields_present: boolean
- status: string

## Preview

```json
{
  "root_http_status": 200,
  "wiki_health_status": 200,
  "query_context_http_status": 200,
  "query_context_has_tiers": true,
  "query_context_tier_counts": {
    "hot": 5,
    "warm": 3,
    "cold": 4
  },
  "query_context_hot_has_agent_task": true,
  "task_context_http_status": 200,
  "task_context_has_tiers": true,
  "task_context_hot_current_task": true,
  "compat_fields_present": true,
  "status": "pass"
}

```