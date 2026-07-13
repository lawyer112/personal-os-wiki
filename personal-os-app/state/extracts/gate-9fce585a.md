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
  "task_id": "cmqrhygy2001v0jo8ngkqee9p",
  "status": "pass",
  "verifier": "hermes",
  "verified_at": "2026-06-24T04:10:35Z",
  "checks": [
    {
      "name": "poc_script_syntax",
      "result": "pass",
      "detail": "Python3 syntax OK, no import errors, executed successfully"
    },
    {
      "name": "sqlite_fts5_available",
      "result": "pass",
      "detail": "SQLite 3.51.0 with FTS5 module confirmed on macOS host"
    },
    {
      "name": "benchmark_ran",
      "result": "pass",
      "detail": "10 benchmark queries across 4 engines completed, metrics JSON generated"
    }
  ],
  "warnings": [
    "Mock embeddings used for PoC; real semantic quality requires Ollama or API provider",
    "Chinese tokenization in FTS5 needs jieba or icu for production"
  ],
  "synthesizer": {
    "allowed_to_announce_done": true
  }
}

```