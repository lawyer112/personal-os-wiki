# worker-result
Format: JSON
Top-level: object
Size: 14
Nested depth: 5

## Schema

- task_id: string
- agent_id: string
- status: string
- summary: string
- artifacts: object (4 keys)
- github_radar: object (5 keys)
- verification: object (6 keys)
- deployment: object (2 keys)
- classic_needs_to_do: string
- created_at: string
- writeback: object (7 keys)
- production_regression: object (4 keys)
- secret_scan: object (4 keys)
- completed_at: string

## Preview

```json
{
  "task_id": "cmqq29yi9000c0jmjcejamrel",
  "agent_id": "obsidianmanager1",
  "status": "completed",
  "summary": "产出 Personal OS/Wiki 优化审计 v0，完成健康矩阵、GitHub 候选、5 个优化点、Agent 执行队列和 Classic 拍板项。",
  "artifacts": {
    "audit_report": "/Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app/.agent-runs/cmqq29yi9000c0jmjcejamrel/audit-report.md",
    "health_checks": "/Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app/.agent-runs/cmqq29yi9000c0jmjcejamrel/artifacts/health-checks.json",
    "github_radar": "/Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app/.agent-runs/cmqq29yi9000c0jmjcejamrel/github-radar",
    "diff_patch": "/Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app/.agent-runs/cmqq29yi9000c0jmjcejamrel/diff.patch"
  },
  "github_radar": {
    "repos_count": 8,
    "top_repos": [
      {
        "full_name": "swarmclawai/swarmvault",
        "url": "https://github.com/swarmclawai/swarmvault",
        "stars": 580,
        "pushed_at": "2026-06-12T10:39:15Z",
        "score": 65.58,
        "signals": [
          "source-registry",
          "context-pack",
          "memory-tiering",
          "graph-recall",
          "agent-hooks",
          "doctor-next"
        ]
      },
      {
        "full_name": "ruvnet/agent-harness-generator",
        "url": "https://github.com/ruvnet/agent-harness-generator",
        "stars": 292,
        "pushed_at": "2026-06-23T11:43:20Z",
        "score": 65.29,
        "signals": [
          "source-registry",
          "context-pack",
          "memory-tiering",
          "graph-recall",
…
```