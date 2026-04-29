# Why Not Just Long-Term Memory?

Personal OS + Personal Wiki is not meant to replace an agent's built-in
long-term memory. It solves a different problem.

Built-in memory helps an agent remember the user. This project gives humans and
multiple agents a shared, inspectable work system.

## Short Version

| Question | Agent long-term memory | Personal OS + Personal Wiki |
| --- | --- | --- |
| What is it for? | Stable preferences, background facts, reusable context. | Current work state, durable knowledge, task ownership, evidence, and review. |
| Who can inspect it? | Usually the current agent or product surface. | The human, Hermes, Codex, reviewer agents, scheduled workers, and local tools. |
| Is it a task source of truth? | No. It can remember tasks but usually lacks leases, status, and review. | Yes. Tasks have status, priority, next action, claims, heartbeats, contributions, and reviews. |
| Can another agent continue the work? | Only if the memory is exposed and interpreted correctly. | Yes. Agents poll APIs, claim tasks, read context packets, submit evidence, and wait for review. |
| Is it auditable? | Weak. Memory may be summarized, hidden, stale, or hard to diff. | Stronger. Markdown notes, DB records, activity logs, artifacts, and reviews are explicit. |
| What should be stored there? | Stable user preferences and operating rules. | Inbox traces, project state, wiki evidence, unfinished tasks, review decisions, and reminder payloads. |
| Main failure mode | The agent remembers something stale and treats it as current truth. | The system can become too bureaucratic if tasks are vague or adapters are not wired. |

## The Boundary

Use agent long-term memory for things that should follow the user across
conversations:

- preferred language and tone
- stable personal rules
- recurring tool locations
- "do not ask me this again" preferences
- durable constraints that rarely change

Use Personal OS + Personal Wiki for things that need to be checked, reviewed, or
worked by more than one agent:

- what work is unfinished
- which task is today’s priority
- which agent claimed a task
- what evidence proves progress
- which project a note supports
- what reminder should be sent
- which Wiki note or source backs a decision

The practical rule:

```text
Memory remembers the person.
Personal OS tracks the work.
Personal Wiki preserves the evidence.
Notification adapters nudge the human.
```

## Hermes, Reminders, And Mac Adapters

Hermes is the reasoning/orchestration layer. Personal OS is the external state
layer. Notification surfaces are adapters.

The intended loop is:

```text
User sends messy input
  -> Hermes classifies it
  -> POST /api/intake
  -> Personal OS creates Inbox / Idea / Task / ProjectEvent / Notification payload
  -> Personal Wiki stores durable Markdown knowledge
  -> Hermes or a scheduled worker calls /api/planner/today or /api/reminders/today
  -> Telegram / Feishu / Apple Reminders / desktop notification adapter sends the nudge
  -> Worker agents poll /api/agent-inbox, claim tasks, submit evidence, and request review
```

The repository currently includes:

- `/api/reminders/today`: returns a ready-to-send reminder payload.
- `/api/planner/today`: returns a richer planning packet for Hermes to reason
  over.
- `/api/notifications/telegram`: creates Telegram-style notification payloads.
- Agent protocol docs for polling, claiming, heartbeating, submitting, and
  reviewing tasks.

The repository does not yet include a native Apple Reminders writer. That should
be an adapter, not part of the task truth. A Mac-side worker can poll
`/api/reminders/today` or `/api/planner/today`, then write to Apple Reminders,
Feishu, Telegram, email, or desktop notifications.

The Mac-side operating contract is documented in
[`MAC_AGENT_ADAPTER.md`](./MAC_AGENT_ADAPTER.md).

## Why This Is Not Wheel Reinvention

If the product only summarized notes, it would duplicate long-term memory and
LLM Wiki tools.

The differentiated layer is the execution contract:

- Inbox keeps the raw trace.
- Wiki keeps durable knowledge and evidence.
- Tasks define the next action and definition of done.
- Claims prevent multiple agents from unknowingly doing the same work.
- Heartbeats make long-running work visible.
- Contributions attach evidence and artifacts.
- Reviews decide whether the work actually counts.
- Reminder/planner endpoints nudge the human without becoming the source of
  truth.

That is the part built-in memory does not provide.

## Design Constraint

Do not let this project drift into "a smarter memory bucket."

Every useful feature should improve at least one of these:

- finding unfinished work
- turning input into executable tasks
- giving agents a safe work contract
- attaching evidence
- making review possible
- nudging the human at the right time

If a feature only stores more text but does not help move work forward, it
belongs in the Wiki layer or in an external memory system, not in Personal OS.
