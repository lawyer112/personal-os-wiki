# benchmark-metrics
Format: JSON
Top-level: object
Size: 2
Nested depth: 4

## Schema

- metrics: object (4 keys)
- details: array (40 items)

## Preview

```json
{
  "metrics": {
    "substring": {
      "avg_latency_ms": 0.035,
      "median_latency_ms": 0.03,
      "avg_precision": 0.43,
      "avg_recall": 0.3
    },
    "fts5": {
      "avg_latency_ms": 0.061,
      "median_latency_ms": 0.051,
      "avg_precision": 0.52,
      "avg_recall": 0.72
    },
    "semantic": {
      "avg_latency_ms": 0.128,
      "median_latency_ms": 0.119,
      "avg_precision": 0.08,
      "avg_recall": 0.45
    },
    "hybrid": {
      "avg_latency_ms": 0.181,
      "median_latency_ms": 0.175,
      "avg_precision": 0.21,
      "avg_recall": 0.95
    }
  },
  "details": [
    {
      "engine": "substring",
      "query": "混合检索",
      "latency_ms": 0.076,
      "results_count": 2,
      "precision": 1.0,
      "recall": 0.67,
      "top3_paths": [
        "vault/30_projects/Personal-OS-Wiki-知识库升级/Personal-OS-Wiki-优化审计-v0-2026-06-23.md",
        "vault/50_knowledge/Reciprocal-Rank-Fusion.md"
      ]
    },
…
```