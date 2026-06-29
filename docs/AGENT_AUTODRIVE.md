# Agent Autodrive Loop

Personal OS Tasks and Personal Wiki notes are not self-executing. A complete loop needs an executor that can claim an `agent_allowed` task, do the work, write evidence back, and move the task to review/done.

## Current loop

```text
/api/intake creates Task/ProjectEvent/Wiki evidence
  -> /api/agent-inbox lists claimable agent_allowed tasks for an AgentProfile
  -> /api/tasks/:id/claim leases one task
  -> worker executes with /api/agent/context evidence
  -> /api/tasks/:id/submit writes contribution and moves task to review
  -> verifier /api/tasks/:id/review approves or returns it
```

## CLI helpers

Run from `personal-os-app/`.

### Pick or claim the next task

```bash
PERSONAL_OS_BASE_URL=http://localhost:3100 \
PERSONAL_OS_API_TOKEN=... \
node scripts/agent-run-next.mjs --agent-id obsidianmanager1 --claim
```

This prints a compact execution brief containing:

- task id
- priority/risk/execution mode
- context URL
- next action
- definition of done
- linked Wiki/evidence
- mandatory writeback command

Use `--peek` to inspect without claiming, and `--json` for machine output.

### Write work back

```bash
node scripts/agent-writeback.mjs \
  --task-id <task_id> \
  --agent-id obsidianmanager1 \
  --summary "What changed and how it was verified" \
  --artifact "https://github.com/org/repo/pull/123" \
  --evidence "https://github.com/org/repo/actions/runs/456" \
  --dod-met \
  --no-human
```

Default behavior is `--submit`: create a contribution and move the task to `review`. A verifier/finalizer can then approve:

```bash
node scripts/agent-writeback.mjs --task-id <task_id> --approve --comment "CI passed; artifact verified."
```

### Reconcile manually completed work

If work finished outside the claim/submit/review protocol, for example a GitHub PR was merged manually before the task was claimed, mark the task explicitly:

```bash
node scripts/agent-mark-task.mjs --task-id <task_id> --done --next "Released in v0.1.2"
```

## Scheduler binding

A cron/webhook executor should:

1. Run `agent-run-next.mjs --claim` for a concrete `agent_id`.
2. If there is no task, exit silently.
3. Launch a worker with the printed brief.
4. Require the worker to produce artifacts under `.agent-runs/<task-id>/` for code/config/release tasks.
5. Run independent verification.
6. Call `agent-writeback.mjs --submit` with evidence and artifacts.
7. Call `agent-writeback.mjs --approve` only when a verifier confirms the definition of done.

Do not run destructive, production restart, paid, public publish, or `approval_required` tasks from the executor. Those must remain blocked until Classic approves.

## Why this was added

The previous conditional trigger only printed "HOT tasks". It detected work but did not claim, execute, or write back task state. That meant tasks could be created and still never move. These helpers make the missing handoff explicit and testable.
