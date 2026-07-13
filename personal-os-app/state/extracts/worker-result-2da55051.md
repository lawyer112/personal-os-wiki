# worker-result
Format: JSON
Top-level: object
Size: 14
Nested depth: 3

## Schema

- task_id: string
- lane: string
- status: string
- exit_code: number
- started_at: string
- ended_at: string
- summary: string
- changed_files: array (1 items)
- commands: array (2 items)
- diff_path: string
- tests_path: null
- artifacts: array (4 items)
- risks: array (0 items)
- blocked_reason: null

## Preview

```json
{
  "task_id": "hermes-e2e-os-canary",
  "lane": "codex",
  "status": "done",
  "exit_code": 0,
  "started_at": "2026-06-23T11:32:28+08:00",
  "ended_at": "2026-06-23T11:33:29+08:00",
  "summary": "HERMES_E2E_OS_CANARY_OK",
  "changed_files": [
    "README.md"
  ],
  "commands": [
    {
      "cmd": "codex exec --ephemeral --json -C '/Users/xingqiwu/Documents/New project 2/.agent-runs/hermes-e2e-os-canary/worktree' -o '/Users/xingqiwu/Documents/New project 2/.agent-runs/hermes-e2e-os-canary/artifacts/codex.final.txt' 'This is a Hermes end-to-end Personal OS canary task.\n\nWork only inside this scratch git repository.\n\nEdit README.md only. Append a new line exactly:\n\nE2E_CANARY=personal-os-roundtrip\n\nDo not modify any other file. After editing, respond with:\n\nHERMES_E2E_OS_CANARY_OK\n'",
      "exit_code": 0,
      "stdout": "artifacts/codex.stdout.txt",
      "stderr": "artifacts/codex.stderr.txt",
      "timed_out": false
    },
    {
      "cmd": "rg '^E2E_CANARY=personal-os-roundtrip$' README.md && git diff -- README.md | rg 'E2E_CANARY=personal-os-roundtrip'",
      "exit_code": 0,
      "evidence": "artifacts/verify-1.log",
      "timed_out": false
    }
  ],
  "diff_path": "diff.patch",
  "tests_path": null,
  "artifacts": [
    "artifacts/codex.final.txt",
    "artifacts/codex.stderr.txt",
    "artifacts/codex.stdout.txt",
    "artifacts/verify-1.log"
  ],
  "risks": [],
  "blocked_reason": null
}

```