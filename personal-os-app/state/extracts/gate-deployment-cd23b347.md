# gate-deployment
Format: JSON
Top-level: object
Size: 10
Nested depth: 4

## Schema

- task_id: string
- deployment_run_at: string
- status: string
- reviewer: object (3 keys)
- verifier: object (3 keys)
- wiki_writeback: object (3 keys)
- deployment: object (5 keys)
- production_regression: object (2 keys)
- synthesizer: object (3 keys)
- writeback: object (3 keys)

## Preview

```json
{
  "task_id": "cmqqfl6rk00090jn58kastmq9",
  "deployment_run_at": "2026-06-24T00:27:00+08:00",
  "status": "pass",
  "reviewer": {
    "status": "pass",
    "findings": [],
    "notes": "Deployment completed on 6.37 via ub37 SSH. Docker build and up succeeded. Production regression verified: /api/today, /api/agent/context, /api/tasks all return 200 ok. PATCH partial update preserves priority/executionMode (taskUpdateSchema regression fixed)."
  },
  "verifier": {
    "status": "pass",
    "commands": [
      {
        "cmd": "ssh ub37 'docker compose -p personal-os-wiki-main build personal-os'",
        "exit_code": 0,
        "evidence": "docker_build.log"
      },
      {
        "cmd": "ssh ub37 'docker compose -p personal-os-wiki-main up -d --no-deps personal-os'",
        "exit_code": 0,
        "evidence": "docker_up.log"
      },
      {
        "cmd": "python3 /tmp/check_health3.py",
        "exit_code": 0,
        "evidence": "health_check.log"
      },
      {
        "cmd": "python3 /tmp/test_patch.py",
        "exit_code": 0,
        "evidence": "patch_regression.log"
      }
    ],
    "screenshots": []
  },
  "wiki_writeback": {
    "status": "pass",
    "evidence": [
      "artifacts/context-pack-cmqqfl6hp00070jn5bgoym7dx/context-pack-intake-result.json"
    ],
…
```