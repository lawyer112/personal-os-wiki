# gate
Format: JSON
Top-level: object
Size: 8
Nested depth: 3

## Schema

- task_id: string
- timestamp: string
- status: string
- actions: array (6 items)
- verifier: object (2 keys)
- production_regression: object (2 keys)
- synthesizer: object (2 keys)
- writeback: object (2 keys)

## Preview

```json
{
  "task_id": "deploy-6.37-20260624",
  "timestamp": "2026-06-24T07:57:00Z",
  "status": "pass",
  "actions": [
    {
      "name": "github-radar-intake",
      "cmd": "node scripts/github-radar-intake.mjs --intake --limit=8 --task-id=github-radar-20260624",
      "exit_code": 0,
      "result": "repos=8, tasks=0 (dedup), registry=8 entries, wiki_write_status=ok, agentRunId=cmqravk4p002i0js0yvtl6w0i"
    },
    {
      "name": "ssh-connectivity-fix",
      "cmd": "ssh -o BatchMode=yes ub37 'echo SSH_OK'",
      "exit_code": 0,
      "result": "SSH_OK using Host ub37 (User=lawyer112) from ~/.ssh/config"
    },
    {
      "name": "backup-deploy",
      "cmd": "cp -r /data/archive/personal-os-wiki/releases/8ade72d/personal-os-app /data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260624-075754/",
      "exit_code": 0,
      "result": "backup completed"
    },
    {
      "name": "rsync-code",
      "cmd": "rsync -avz --delete --exclude=node_modules --exclude=.next --exclude=.git --exclude=.env --exclude=data local/../personal-os-app/ ub37:/data/archive/.../personal-os-app/",
      "exit_code": 0,
      "result": "sent 108964 bytes; total size 959593"
    },
    {
      "name": "docker-build",
      "cmd": "docker compose -p personal-os-wiki-main build personal-os",
      "exit_code": 0,
      "result": "Image personal-os-app:demo built successfully"
    },
    {
      "name": "docker-up",
      "cmd": "docker compose -p personal-os-wiki-main up -d --no-deps personal-os",
      "exit_code": 0,
      "result": "Container personal-os-wiki-main-personal-os-1 recreated and started"
…
```