# gate
Format: JSON
Top-level: object
Size: 7
Nested depth: 3

## Schema

- task_id: string
- status: string
- verifier: string
- verified_at: string
- checks: array (3 items)
- warnings: array (2 items)
- synthesizer: object (1 keys)

## Preview

```json
{
  "task_id": "cmqrhygxf001s0jo8hy523haz",
  "status": "pass",
  "verifier": "hermes",
  "verified_at": "2026-06-24T05:24:00Z",
  "checks": [
    {
      "name": "poc_script_syntax",
      "result": "pass",
      "detail": "Python3 syntax OK, imports resolved, no runtime errors"
    },
    {
      "name": "unit_tests",
      "result": "pass",
      "detail": "8 unit tests passed in 0.044s (mapping, query BFS/DFS, path, explain, fuzzy resolution, performance)"
    },
    {
      "name": "performance_budget",
      "result": "pass",
      "detail": "100-node graph: average query/path < 1ms, well under 10ms budget"
    }
  ],
  "warnings": [
    "SwarmVault hyperedges/communities not mapped; Personal Wiki graph lacks these constructs",
    "Filtering by evidenceClass/language not exercised; trivial to add if needed"
  ],
  "synthesizer": {
    "allowed_to_announce_done": true
  }
}

```