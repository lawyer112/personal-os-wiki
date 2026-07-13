# worker-result
Format: JSON
Top-level: object
Size: 11
Nested depth: 3

## Schema

- taskId: string
- title: string
- status: string
- completedAt: string
- summary: string
- filesChanged: array (2 items)
- artifacts: object (5 keys)
- verification: array (3 items)
- claim: object (4 keys)
- deployment: object (2 keys)
- remainingRisks: array (3 items)

## Preview

```json
{
  "taskId": "cmr1kaxne00hc0ipolmjyzdss",
  "title": "部署 WikiWriteJob migration 并启动 Wiki 写队列 worker",
  "status": "partial_success",
  "completedAt": "2026-07-01T07:55:49.551777+00:00",
  "summary": "为生产 docker-compose 增加 wiki-worker 独立 service，循环执行 scripts/process-wiki-write-jobs.mjs --loop，把 queued/retry WikiWriteJob 推进到 done/retry/failed；同时移除脚本对 dotenv/config 包的硬依赖，保留显式读取 Hermes profile .env 与容器环境变量。",
  "filesChanged": [
    "docker-compose.prod.yml",
    "scripts/process-wiki-write-jobs.mjs"
  ],
  "artifacts": {
    "diff": ".agent-runs/cmr1kaxne00hc0ipolmjyzdss/diff.patch",
    "diffStat": ".agent-runs/cmr1kaxne00hc0ipolmjyzdss/diff-stat.txt",
    "gitStatus": ".agent-runs/cmr1kaxne00hc0ipolmjyzdss/git-status.txt",
    "workerResult": ".agent-runs/cmr1kaxne00hc0ipolmjyzdss/worker-result.json",
    "gate": ".agent-runs/cmr1kaxne00hc0ipolmjyzdss/gate.json"
  },
  "verification": [
    {
      "command": "node scripts/process-wiki-write-jobs.mjs --help && node --check scripts/process-wiki-write-jobs.mjs",
      "status": "pass"
    },
    {
      "command": "npm run lint",
      "status": "pass"
    },
    {
      "command": "docker compose -f docker-compose.prod.yml config --quiet",
      "status": "blocked",
      "reason": "current Hermes env lacks POSTGRES_PASSWORD; Docker daemon is also unavailable, so production compose/deploy cannot be completed from this host."
    }
  ],
  "claim": {
    "status": "failed",
    "endpoint": "POST /api/tasks/cmr1kaxne00hc0ipolmjyzdss/claim",
    "httpStatus": 403,
    "reason": "Agent profile is missing or disabled for agentId obsidianmanager1-cron"
  },
  "deployment": {
    "status": "not_deployed",
…
```