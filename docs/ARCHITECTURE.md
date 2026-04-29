# Architecture

Personal OS + Personal Wiki is designed as a local-first agent operating system.
The core question is not "where should notes live?" but "how does a human input
become useful work?"

## Design Goals

- Capture rough input without forcing the user to be structured.
- Preserve the original trace so future agents can audit where a task or note
  came from.
- Store durable knowledge in Markdown, not only in chat history.
- Store execution state in a database, not only in a wiki page.
- Give agents a stable contract for polling, claiming, executing, and reviewing
  tasks.
- Keep private data outside Git so the engine can be open sourced safely.

## Non-Goals

- This is not a hosted multi-tenant SaaS.
- This is not a replacement for every note-taking app.
- This is not a magic autonomous agent that should modify private data without
  review.
- This repository should not contain the operator's real vault, real tasks, real
  server inventory, or real credentials.

## Component Boundary

```text
Personal OS
  stateful execution system
  Postgres-backed
  owns inbox, tasks, ideas, projects, agent runs, claims, reviews

Personal Wiki
  durable knowledge system
  Markdown-backed
  owns notes, tags, concepts, search index, graph, browser rendering

Agents
  reasoning and execution layer
  call APIs, write evidence, submit work for review
```

The boundary is intentional. If tasks live only in Markdown, agents have no
lease, review, heartbeat, or status semantics. If knowledge lives only in
Postgres rows, humans lose the readability and portability of a Markdown vault.

## Intake Flow

```text
Human input
  v
POST /api/intake
  v
Personal OS writes:
  - InboxItem
  - AgentRun
  - Idea
  - Task
  - ProjectEvent
  - ActivityLog
  - Notification payload
  |
  +--> Personal Wiki writes:
       - Markdown note
       - tags
       - concepts
       - graph links
```

The intake endpoint is the normal entrypoint for Hermes-style agents because it
keeps the operation atomic at the product level: raw input, tasks, ideas, notes,
and notification payloads are created together.

## Task Execution Flow

```text
Agent polls /api/agent-inbox
  v
Agent claims task
  v
Agent loads /api/agent/context
  v
Agent executes outside Personal OS
  v
Agent heartbeats and writes contributions
  v
Agent submits for review
  v
Human or reviewer agent approves, requests changes, blocks, rejects, or archives
```

Personal OS does not need to be the reasoning engine. It is the coordination
surface. Any agent can participate if it follows the protocol.

## Main Data Objects

| Object | Owned by | Purpose |
| --- | --- | --- |
| InboxItem | Personal OS | Original user input and source metadata. |
| Idea | Personal OS | Captured thought that is not yet a task. |
| Task | Personal OS | Executable unit with status, priority, next action, and definition of done. |
| TaskClaim | Personal OS | Lease showing which agent is currently working on a task. |
| TaskContribution | Personal OS | Progress note, evidence links, artifacts, and next recommendation. |
| TaskReview | Personal OS | Review decision and audit trail. |
| Project | Personal OS | Product/workstream container. |
| ProjectEvent | Personal OS | Timeline of decisions and progress. |
| Markdown note | Personal Wiki | Durable human-readable knowledge. |
| Graph edge | Personal Wiki | Relationship between notes, concepts, and links. |

## Agent Context

Agents should use `GET /api/agent/context?taskId=<id>` before executing a task.
The response is a curated context packet:

- task fields
- project state
- source inbox item
- prior contributions
- artifacts
- reviews
- related tasks and ideas
- candidate Wiki notes
- execution policy

This prevents two bad patterns:

- The agent blindly searches the whole vault and drowns in unrelated notes.
- The agent relies only on recent chat and misses durable knowledge.

## Notifications

Personal OS generates notification payloads; it does not have to send them
itself. A Telegram, Feishu, Apple Reminders on a Mac, email, or desktop
notification worker can read a payload and deliver it.

This keeps the product boundary clean:

```text
Personal OS decides what should be said.
Notification adapters decide where and how to send it.
```

Apple Reminders and similar apps should stay adapters. They can mirror or nudge
from `/api/reminders/today` and `/api/planner/today`, but Personal OS remains the
task source of truth.

## Long-Term Memory Boundary

Built-in agent memory is useful for stable preferences and durable operating
rules. It is not the right place for task leases, review decisions, reminder
payloads, or evidence trails.

The product split is:

```text
Agent memory  = remembers the person
Personal OS   = tracks the work
Personal Wiki = preserves the evidence
Adapters      = nudge the human
```

For the detailed comparison, see
[`WHY_NOT_LONG_TERM_MEMORY.md`](./WHY_NOT_LONG_TERM_MEMORY.md).

## Security Model

- Runtime tokens are loaded from environment variables.
- Tokens must not be passed through URLs.
- Write APIs require bearer tokens.
- Public examples use placeholders and localhost URLs.
- Runtime vaults, logs, uploads, generated files, and database dumps stay out of
  Git.
- A public release must pass a secret/private-data scan.

## Why Not One System?

Using only a wiki makes task execution weak. There is no native notion of task
claiming, heartbeats, review decisions, or status transitions.

Using only a database makes knowledge weak. Long-form knowledge becomes trapped
in rows, harder for humans to edit, harder to diff, and less compatible with
Obsidian-style workflows.

The project uses both because they solve different parts of the problem.
