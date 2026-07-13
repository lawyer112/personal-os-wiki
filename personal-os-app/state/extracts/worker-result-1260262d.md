# worker-result
Format: JSON
Top-level: object
Size: 7
Nested depth: 3

## Schema

- task_id: string
- profile: string
- model: string
- run_at: string
- actions: array (8 items)
- blockers: array (0 items)
- next_recommendation: string

## Preview

```json
{
  "task_id": "deploy-6.37-20260624",
  "profile": "obsidianmanager1",
  "model": "kimi-k2.7-code",
  "run_at": "2026-06-24T07:57:00+08:00",
  "actions": [
    {
      "step": 1,
      "action": "run github-radar-intake.mjs --intake --limit=8 --task-id=github-radar-20260624",
      "result": "repos=8, tasks=0 (all dedup), intake ok, wiki_write_status=ok, agentRunId=cmqravk4p002i0js0yvtl6w0i"
    },
    {
      "step": 2,
      "action": "discover prior deploy blocker for agent-context-next-action-20260624: SSH to 6.37 blocked",
      "result": "found .agent-runs/agent-context-next-action-20260624/gate.json with deployment.blocked=true due to SSH key issue"
    },
    {
      "step": 3,
      "action": "fix SSH access: use correct Host ub37 (User=lawyer112) instead of root@192.168.6.37",
      "result": "SSH_OK confirmed on ub37 with BatchMode=yes"
    },
    {
      "step": 4,
      "action": "backup current 6.37 deployment to /data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260624-075754/",
      "result": "backup completed via cp -r"
    },
    {
      "step": 5,
      "action": "rsync verified local code to 6.37 /data/archive/personal-os-wiki/releases/8ade72d/personal-os-app/",
      "result": "sent 108964 bytes; total size 959593; excluded node_modules/.next/.git/.env/data"
    },
    {
      "step": 6,
      "action": "docker compose -p personal-os-wiki-main build personal-os",
      "result": "Image personal-os-app:demo built successfully (sha256:978890fe900c...)"
    },
    {
      "step": 7,
      "action": "docker compose -p personal-os-wiki-main up -d --no-deps personal-os",
      "result": "Container personal-os-wiki-main-personal-os-1 recreated and started"
…
```