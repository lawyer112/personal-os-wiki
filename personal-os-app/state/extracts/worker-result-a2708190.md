# worker-result
Format: JSON
Top-level: object
Size: 12
Nested depth: 3

## Schema

- task_id: string
- agent_id: string
- status: string
- started_at: string
- ended_at: string
- summary: string
- changed_files: array (2 items)
- diff_path: string
- diff_stat: string
- commands: array (7 items)
- risks: array (3 items)
- writeback: object (5 keys)

## Preview

```json
{
  "task_id": "cmqqb0ddq00080jnsxuwdqoa5",
  "agent_id": "obsidianmanager1",
  "status": "done",
  "started_at": "2026-06-23T15:47:00Z",
  "ended_at": "2026-06-23T15:58:00Z",
  "summary": "Updated .github/dependabot.yml to cover personal-wiki pip ecosystem and added npm groups with commit-message prefixes. Created personal-wiki/requirements.txt to declare no external pip deps. CI passed on PR #33, merged into main. No secrets leaked.",
  "changed_files": [
    ".github/dependabot.yml",
    "personal-wiki/requirements.txt"
  ],
  "diff_path": "diff.patch",
  "diff_stat": ".github/dependabot.yml | 29 +++++++++++++++++++++++++++++\n personal-wiki/requirements.txt | 5 +++++\n 2 files changed, 34 insertions(+)",
  "commands": [
    {
      "cmd": "npm audit --omit=dev --audit-level=moderate",
      "exit_code": 0,
      "evidence": "0 vulnerabilities"
    },
    {
      "cmd": "npx tsc --noEmit",
      "exit_code": 0,
      "evidence": "no errors"
    },
    {
      "cmd": "npm run build (with DATABASE_URL)",
      "exit_code": 0,
      "evidence": "build success"
    },
    {
      "cmd": "npm test",
      "exit_code": 0,
      "evidence": "20 passed (78 tests)"
    },
    {
      "cmd": "python3 -m py_compile personal-wiki/api/server.py",
      "exit_code": 0,
      "evidence": "py_compile ok"
    },
    {
…
```