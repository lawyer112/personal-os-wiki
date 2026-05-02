# Maintenance Manual

This manual is the public-safe handoff document for maintainers and agents
working on Personal OS + Personal Wiki.

It is not a private operations journal. Do not put real server addresses,
tokens, customer data, private Wiki contents, screenshots, local usernames, or
personal task history in this repository.

## Product Thesis

Personal OS + Personal Wiki should not become another generic knowledge base,
RAG app, task board, or autonomous agent runtime.

The durable product boundary is:

```text
Personal OS   = task truth, project state, claims, leases, reviews, reminders
Personal Wiki = durable knowledge, evidence, decisions, workflow notes
Executors     = Hermes, OpenClaw, Codex, Claude Code, scheduled workers
Adapters      = Telegram, Feishu, Apple Reminders, email, desktop notifications
```

The product exists to answer:

```text
What should move next?
Who or which agent owns it?
What evidence proves it moved?
Who reviewed it?
What knowledge changed because of the result?
```

If a feature only stores more text, it belongs in the Wiki layer or an external
memory tool. If a feature helps agents claim, execute, submit evidence, or get
reviewed, it belongs in the Personal OS execution loop.

## Public vs Private Records

Use this public repository for:

- product direction that does not expose personal data;
- source code, tests, docs, fake demo data, and release packages;
- generic operating procedures any user can follow;
- issue tracking for public-safe product work;
- API contracts and agent protocol docs.

Use a private Personal Wiki or private repository for:

- real deployment hostnames, LAN IPs, ports, usernames, paths, and service names;
- real tokens, API keys, cookies, SSH details, and credential locations;
- personal task history, private project status, customer notes, and server
  inventory;
- real screenshots or logs that may contain private data;
- instance-specific rollback notes.

The private maintenance note should mirror this structure, but with real
environment facts. Never copy the private note back into GitHub.

## Current Public State

Last checked: 2026-05-02.

Shipped and working:

- Root Docker demo and platform helper scripts.
- Personal OS Next.js app with Inbox, Ideas, Projects, Tasks, Notes, Today,
  agent runs, task claims, heartbeats, contributions, artifacts, submissions,
  reviews, activity logs, and notification payloads.
- Personal Wiki Python service with Markdown ingest, note pages, search, tags,
  concepts, graph data, and read/write token boundaries.
- Agent protocol docs for polling, claiming, loading context, heartbeating,
  contributing, submitting, and reviewing.
- Fake seed data showing a task claim, submitted evidence, and approved review.
- CI for tests, dependency audit, typecheck, lint, app build, Docker builds,
  Wiki compile, graph tests, release package smoke test, and private-data scan.
- Versioned package script for `.zip`, `.tar.gz`, and `SHA256SUMS.txt`.

Partially implemented or still mostly documentation:

- Real external executor adapters for Hermes, OpenClaw, Codex, or Claude Code.
- A built-in demo worker that runs the full claim -> evidence -> review loop.
- MCP server integration.
- Capability-aware agent routing.
- First-class task execution runs and structured action logs.
- Review dashboard focused on evidence and definition-of-done checks.
- Object-style Wiki rebuild, Wiki lint, and knowledge-gap task generation.
- Native Apple Reminders, Feishu, Telegram, or email delivery workers.

## Strategic Backlog

Work should move in this order unless a security fix is blocking release.

| Priority | Work | Reason |
| --- | --- | --- |
| P0 | Built-in demo agent or smoke worker | Proves the product is not only a task board. |
| P0 | Review dashboard | Makes the strongest differentiator visible. |
| P1 | `executionMode` on tasks | Separates manual work, suggested agent work, allowed agent work, and approval-required work. |
| P1 | `AgentProfile` capability registry | Prevents agents from claiming tasks they cannot safely execute. |
| P1 | `TaskRun` and `AgentActionLog` | Turns task execution into an auditable ledger, not just final summaries. |
| P1 | MCP server | Lets external agents and IDE tools read tasks and Wiki context through a standard interface. |
| P2 | LLM Wiki compatibility notes | Borrow the LLM Wiki pattern without competing as a pure Wiki product. |
| P2 | Object knowledge rebuild | Makes Wiki notes usable as agent-maintained project, workflow, evidence, and decision objects. |
| P2 | Notification delivery adapters | Keep nudges outside task truth while making daily work visible to the user. |
| P3 | Mobile capture and browser clipper polish | Useful after the execution loop is proven. |

Do not prioritize generic PKM features over the execution loop.

## Agent Handoff Loop

Any agent taking over the repository should start with this loop:

1. Inspect the repository state.

   ```bash
   git status --short
   git log -1 --oneline
   gh issue list --state open --limit 20
   gh run list --branch main --limit 5
   ```

2. Read the core handoff docs:

   - `README.md`
   - `docs/MAINTENANCE_MANUAL.md`
   - `docs/ROADMAP.md`
   - `docs/HUMAN_AGENT_COLLABORATION_ROADMAP.md`
   - `docs/AGENT_GUIDE.md`
   - `docs/DATA_SAFETY.md`

3. Choose one bounded improvement. Prefer an open GitHub issue. If the work is
   not tracked, create or document a public-safe issue before or during the
   change.

4. Implement a complete, reviewable unit. Do not mix unrelated work.

5. Update docs that changed behavior, especially:

   - `README.md`
   - `docs/README.md`
   - `docs/MAINTENANCE_MANUAL.md`
   - `docs/ROADMAP.md`
   - `CHANGELOG.md`

6. Verify locally before pushing.

7. Push and wait for CI. Do not call the work done until the main CI result is
   known or a failure is explained.

## Verification Checklist

Run the checks relevant to the files touched.

Personal OS:

```bash
cd personal-os-app
npm test
npm run lint
npx tsc --noEmit
DATABASE_URL="postgresql://personal_os:replace-with-a-long-random-database-password@localhost:54329/personal_os?schema=public" npm run build
```

Personal Wiki:

```bash
python -m py_compile personal-wiki/api/server.py
python -m unittest discover personal-wiki/tests
```

Repository packaging and hygiene:

```powershell
git diff --check
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-release.ps1
```

GitHub:

```bash
gh run list --branch main --limit 5
gh run watch <run-id> --exit-status
```

If a check is skipped, state why in the final handoff.

## Security And Leak Checklist

Before every commit or package release, confirm that the diff does not contain:

- `.env` files or credential exports;
- real tokens, API keys, cookies, SSH keys, or passwords;
- real private hostnames, LAN IPs, ports, usernames, or filesystem paths;
- real inbox messages, reminders, customer data, private project notes, or
  server inventories;
- generated runtime data such as `.next`, `node_modules`, populated vaults,
  logs, pid files, release archives, or screenshots with private data.

Use fake data for all public screenshots, GIFs, docs, tests, and demos.

## Private Maintenance Journal Template

Keep a separate private note for real operations. Suggested title:

```text
Personal OS Wiki - Private Maintenance Journal
```

Use this structure in the private Wiki:

```markdown
# Personal OS Wiki - Private Maintenance Journal

## Current Deployment

- Host:
- Services:
- Ports:
- Runtime paths:
- Token locations:
- Backup location:

## Latest Operation

- Date:
- Agent/operator:
- Goal:
- Commands or actions:
- Files/services changed:
- Verification:
- Rollback path:
- Follow-up task:

## Open Private Tasks

- [ ] Task:
  - Why it matters:
  - Owner:
  - Evidence needed:
```

Do not paste real secrets into the private note either. Store secret locations,
not secret values.

## End-Of-Work Handoff Format

Every agent should finish with:

```text
Changed:
- ...

Why:
- ...

Verification:
- ...

GitHub:
- commit:
- issue:
- CI:

Risks:
- ...

Next:
- ...
```

This makes work resumable by the next agent without relying on chat history.
