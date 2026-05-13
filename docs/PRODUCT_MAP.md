# Product Map

This document is the product-layer map for Personal OS + Personal Wiki + the
Hermes team. It is not a spec, not a requirements document, and not an
implementation checklist. Its single purpose: when you (or a future maintainer)
feel lost again, come back here and you should know "where we are, what is
next, and why."

The engineering gap list lives in
[`HUMAN_AGENT_COLLABORATION_ROADMAP.md`](./HUMAN_AGENT_COLLABORATION_ROADMAP.md).
This document sits one layer above it and explains *why* those gaps matter.

Chinese version: [`PRODUCT_MAP.zh-CN.md`](./PRODUCT_MAP.zh-CN.md).

---

## 1. Endgame

```
                     ┌─────────────────────────┐
                     │  User (you / customer)  │
                     │  Telegram / phone / voice│
                     └──────────┬──────────────┘
                                │
                                ▼
               ┌────────────────────────────────────┐
               │      Hermes Agent Team             │
               │  (Mac Mini / private host / cloud) │
               │                                    │
               │   Capture bot (intake)             │
               │     ↓                              │
               │   Dispatcher (plan / ask / route)  │
               │     ↓                              │
               │   Worker (tools / artifacts)       │
               │     ↑                              │
               │  (phase 2: workers load Skill      │
               │   packs to become "specialists")   │
               └──────────┬─────────────────────────┘
                          │ read / write / events
                          ▼
    ┌──────────────────────────────────────────────────┐
    │  Personal OS (coordination hub)                  │
    │  - who does what, when to wake whom,             │
    │    what to ask the user                          │
    │  - Inbox / Task / Idea / Project / Clarification │
    │  - TaskRun / ActionLog audit                     │
    │  - does NOT store durable knowledge              │
    └──────────────────┬───────────────────────────────┘
                       │ links / hooks
                       ▼
    ┌──────────────────────────────────────────────────┐
    │  Personal Wiki (external memory)                 │
    │  - durable knowledge + project archive + traces  │
    │  - structured vault + uniform frontmatter        │
    │  - topology: search a tag to see                 │
    │    "who did what when"                           │
    └──────────────────┬───────────────────────────────┘
                       │ future
                       ▼
                Obsidian plugin (same graph, another view)

Commercial form: package all of the above → anyone can install their own
Hermes assistant team.
```

Core triangle:

- Personal OS = coordination hub (live state, scheduling, audit)
- Personal Wiki = external memory (durable knowledge, project archive, trace)
- Hermes team = the hands (listen, route, execute)

Wiki is memory, OS is cortex, Hermes is body. All three are required.

---

## 2. Division of Responsibility

Keeping clear boundaries is the precondition for this product not to drift.

### Personal OS owns

- Live state: Inbox, Task, Idea, Project, Clarification, Notification
- Scheduling: who should do this, when to wake whom
- Audit: TaskRun, ActionLog, Review, DailyPlan
- Permissions: AgentProfile (who can read, who can write, risk ceiling)
- Does not store durable knowledge, only links to it

### Personal Wiki owns

- Durable knowledge: project archive, reference material, reusable playbooks,
  decision records
- Raw input archive: articles, transcripts, screenshots, exported text
- Execution trace: a summary note per completed agent task
- Retrieval: full-text search, tags, concepts, topology graph
- Does not schedule and does not know "what is today's work"

### Hermes team owns

- Listening (receive user input)
- Thinking (read OS tasks, read Wiki memory, decide next step)
- Asking (if uncertain, ask the user instead of guessing)
- Executing (call Telegram, Web, Calendar, Shell, LLM tools)
- Logging (write back to OS audit, write Wiki knowledge)
- Does not manage state, does not own long-term storage

**One-line routing**:

- Will you want to look this up later? → Wiki
- Does this need to happen today? → OS
- Does this need hands-on action? → Hermes

---

## 3. Agent Roles (phase 1)

The Mac Mini runs multiple independent Hermes profiles (each with its own
SOUL, memory, bot token), not "one brain with different modes". Personal OS
acknowledges that reality.

Phase 1 defines three kinds of agents. Do not add more.

### Capture bot (intake)

- Entry: the Telegram bot the user chats with
- Job: listen + write into Personal OS / Wiki
- Not this bot's job: planning, execution, asking clarifying questions
- Output: InboxItem, optional Idea / Task / Wiki note
- AgentProfile: `tags=["intake"]`, `canWriteTasks=true`

### Dispatcher (the main assistant)

- Entry: woken by Personal OS webhook or by schedule
- Job: read tasks, plan the day, pick a target agent, ask the user when
  needed
- Not this bot's job: using tools directly (web fetch, scraping, generating
  images)
- Output: task dispatches, Clarifications, Telegram replies
- AgentProfile: `tags=["dispatcher"]`, max risk medium

### Worker (executor)

- Entry: woken by Personal OS webhook or polls `/api/agent-inbox`
- Job: claim task, call tools, produce artifacts, write Wiki, submit
- Can run as multiple instances (one per machine or one per queue)
- Output: Artifact, Wiki note, Contribution
- AgentProfile: `tags=["worker"]`, max risk low~medium

**Note**: From the user's point of view there is still only one bot (the
capture bot). When the dispatcher speaks, the payload is generated by
Personal OS and sent through that same bot. The user does not perceive "a
team", only "the assistant moves on its own sometimes."

In phase 2, "travel specialist / futures manager / poster designer" are not
new agents; they are the worker loading different Skill packs. Same process,
different behavior based on task tag. This avoids process explosion and
keeps commercial packaging simple.

---

## 4. Phases

### Phase 1: Wire up + Organize Wiki (two stages: MVP + harden)

**Definition**: Turn the dormant protocol into a live loop, and clean up the
messy Wiki.

Split into two stages (**not tied to a calendar, ship each as fast as it
can be done correctly**):

- **MVP**: cut to the bone, make the Tokyo trip scenario work.
  Accept "works when the agent behaves."
- **Harden**: add fallbacks, webhook, quality checks. Survive when
  the agent misbehaves.

Why two stages instead of one push: ship a visible loop first; see problems
with your own eyes; then decide where the remaining effort should go.
Avoids "spent the full budget on insurance for the wrong product."

**Three tracks (must ship together, not one at a time)**:

**A. Hermes side — wire up**

- Three role definitions: capture bot / dispatcher / worker
- Per-role AGENT_PROMPT (no more single prompt for every situation)
- Webhook listener (receives pushes from Personal OS)
- Telegram button callback handling and reply

**B. Personal OS side — schedule**

- Promote AgentProfile to a first-class identity: endpoint, bot_token, role
- Event dispatch: new task / idea / clarification pushed to target agent by
  tag / capability
- Clarification object: pause task + question + options + timeout + status
- Notification payload: buttons upgraded from link-open to callback
- User-answer write-back endpoint + wake the originating agent
- Submit hook: completed task auto-writes a summary note to Wiki (with
  frontmatter)

**C. Wiki side — organize**

- Vault directory restructure (see next section)
- Frontmatter spec (every note must carry `agent`, `task`, `project`,
  `created_by`)
- `/api/ingest` upgrade: writes must include attribution, auto-placed in
  the right folder
- Migration script for legacy content
- MOC (Map of Content) generator: `00_meta/index.md` maintained
  automatically

**Phase 1 success criterion** (single acceptance scenario):

1. You send "May 15, Tokyo, 3 days" to the capture bot
2. Within 30 seconds, the dispatcher replies through the same bot:
   "Want a trip plan? [Plan] [Work only] [Skip]"
3. You tap [Plan] on your phone
4. The worker claims the task, calls LLM + Web, produces a plan
5. Wiki automatically gains `30_projects/2026-05 Tokyo trip/` with notes on
   itinerary, hotels, transit, each with `agent: <id>`, `task: <id>`,
   `project: Tokyo trip`
6. A Wiki search for `tag:agent-produced` shows this output
7. Personal OS Today page shows the task's full trace:
   review → todo → doing → submitted → done

If this scenario works end-to-end, the "assistant feel" is real.

### MVP trade-offs

To ship MVP fast, the following are cut and moved to the harden stage:

| Cut | MVP simplified version |
|---|---|
| Webhook push | polling `/api/agent-inbox` every 5~10 min |
| Full Wiki restructure + migration | only add `30_projects/` and `40_journals/`; enforce frontmatter; legacy content untouched |
| MOC auto-generator | none, use Wiki search |
| Complex Clarification (multi-round, retract, edit) | single-round, three fixed buttons, 24h timeout then archive |
| Full AgentProfile upgrade | only three fields: `role`, `bot_token_ref`, `endpoint` |
| OS-side candidate pre-generation (agent picks from options) | skip; rely on agent prompt + minimal validation |
| Full server-side quality gate | only three hard checks: non-empty `nextAction`, required frontmatter, `agent_id` present |
| Event batching | none; events processed on arrival (fine at low volume) |

**MVP task groups** (see `.kiro/specs/wiki-vault-restructure/tasks.md`):

- Group 1: OS changes — AgentProfile three fields, Clarification object,
  answer write-back, submit-triggers-Wiki-write
- Group 2: Wiki changes — `/api/ingest` frontmatter requirement, two new folders
- Groups 3-5: Hermes three-role prompts, capture bot rework, callback button
  handling, worker polling script
- Group 6: Run the Tokyo acceptance scenario, fix bugs
- Group 7: AGENT_PROMPT cleanup, usage docs

### Harden stage scope

- Webhook push (drop polling latency from 5~10 min to sub-second)
- OS-side candidate pre-generation (agent makes choices, not guesses)
- Full server-side quality gate
- Failure / retry strategy (lease expire, agent crash, answer timeout)
- Legacy Wiki migration script
- MOC auto-generator
- Event batching (dispatcher batches every 5~10 min to save LLM)
- Cost visibility (estimate tokens before large tasks, ask user above
  threshold)

### What phase 1 will not do

- Domain specialists (phase 2: Skill packs)
- Workflow / Skill as first-class object
- Checklist-based review criteria
- Obsidian plugin
- Commercial packaging

### Phase 2: Specialization

**Definition**: Workers go from "generic" to "capable in a domain".

- **Skill pack mechanism**: "trip planning", "futures data", "poster
  template" become loadable Skills. Worker loads by task tag. Skill itself
  is `50_skills/*.md` + a tool config.
- **Review criteria**: each Skill ships a self-check list that workers run
  before submit. Less review load for the user.
- **Workflow / Skill as first-class object**: roadmap items 6 and 8.
- **Wiki learning loop**: approved task outputs are suggested back into
  relevant Skills so the next run is smarter.

### Phase 3: Distributable

**Definition**: Others can install their own copy.

- **Obsidian plugin**: topology / frontmatter / MOC visible inside Obsidian.
- **SaaS or local installer**: docker-compose, one-click script, hosted
  version.
- **Assistant team template**: downloadable "Hermes Team Kit" with default
  prompts, default Skills, default Wiki layout.

---

## 5. Wiki Organization

The problem today: half-human, half-agent writes, no rule for "who writes,
where it lands". So the vault is messy.

### Target structure

```
vault/
├── 00_meta/                  index, MOC, tag rules, layout doc
│   ├── index.md              global index (auto-generated)
│   ├── tags.md               tag meaning and usage
│   └── structure.md          short version of this doc
├── 10_sources/               raw input (kept as-is, never rewritten)
│   ├── articles/             articles, page captures
│   ├── transcripts/          voice, meetings, DeepTalk exports
│   └── screenshots/          screenshots
├── 20_atoms/                 atomic notes: one concept per file, reusable
│   └── tokyo-transit.md
│   └── japan-visa.md
├── 30_projects/              project archive: one folder per project
│   └── 2026-05 Tokyo trip/
│       ├── README.md         overview + status + next action
│       ├── itinerary.md      ← agent output
│       ├── hotel-candidates.md ← agent output
│       └── retrospective.md  ← added afterward, by user or agent
├── 40_journals/              daily journals: "what happened today"
│   └── 2026-05-11.md         ← dispatcher writes daily summary here
├── 50_skills/                reusable playbooks (used in phase 2)
│   └── trip-planning.md
│   └── ocr-evaluation.md
└── 90_archive/               archive: expired, deprecated, experimental
```

### Every note carries frontmatter

```yaml
---
title: Tokyo Transit
type: atom                   # atom | project | journal | skill | source
created_by: hermes:worker    # user | hermes:intake | hermes:dispatcher | hermes:worker
agent_id: worker-001         # specific agent instance (optional)
task_id: task_abc123         # linked Personal OS task (required for agent output)
project: 2026-05 Tokyo trip  # linked project (optional)
source_type: agent-output    # user-note | article | transcript | agent-output
tags: [travel, tokyo, transit]
created_at: 2026-05-11T10:30:00+08:00
last_reviewed: 2026-05-11    # last human review (optional)
---
```

**Why this matters**:

- `tag:agent-output` reveals everywhere Hermes has touched the vault
- `task_id` back-links to Personal OS for the full execution trace
- `project` lets the topology graph cluster correctly
- `last_reviewed` surfaces "knowledge that no one has checked in a long
  time" (likely stale)

### Migration

Current vault has:

- `10_sources/` ✅ keep
- `20_notes/` → split: concepts go to `20_atoms/`, project material goes to
  `30_projects/`
- `90_archive/` ✅ keep
- `Personal OS Inbox/` → split: notification logs to `40_journals/`,
  knowledge content to `20_atoms/`
- `Personal Wiki Mirror/` → inspect and decide case by case; likely archive

Needs a migration script (separate task, expect human review).

---

## 6. Why Every Action Leaves a Trace

A recurring theme: "everything Hermes does must be auditable later."

This is not just a feature. It is the core value proposition. So at the OS
and Wiki layer we make these rules explicit.

1. **Every agent submit produces**:
   - Personal OS TaskRun + ActionLog (live state)
   - At least one Wiki summary note (memory, with attribution frontmatter)
2. **Every capture bot intake produces**:
   - Personal OS InboxItem (original text preserved)
   - If the content is knowledge, a Wiki source note
3. **Every Clarification round-trip is recorded**:
   - Personal OS ActivityLog
   - Telegram message id (back to chat history)
4. **Every dispatcher daily plan lands**:
   - Personal OS DailyPlan snapshot
   - A "Today's Agent Suggestion" section inside `40_journals/<date>.md`

These rules are baked into phase 1. After phase 1, you have a system where
any day, any agent action is auditable.

---

## 7. How We Cope with Flaky Agents

Hermes will misbehave — missing fields, forgetting heartbeat, writing
garbage tasks like "organize the Wiki", guessing when it should ask.
This is a fact, not a bug. **We do not solve this by "making the agent
smarter"; we add engineering guardrails.**

Four principles across phase 1 and phase 2:

### Principle 1: multiple-choice, not fill-in-the-blank

Server-side rules and templates pre-slice raw input into candidate
objects. The agent only accepts / edits / rejects. It can pick wrong,
but it cannot invent garbage out of thin air.

Lands in: the harden stage, where `/api/intake` pre-classifies
input and feeds candidates to the agent.

### Principle 2: server validates, does not trust agent self-report

"Task done" is not enough. On submit, Personal OS checks:

- Does `nextAction` start with a verb?
- Is `definitionOfDone` verifiable?
- Does the Wiki note carry required frontmatter?
- Are `artifactUrls` reachable?

Fail → bounce back, agent retries.

Lands in: MVP only enforces three hard checks (non-empty nextAction,
required frontmatter, agent_id present); harden phase completes the gate.

### Principle 3: every step atomic and retryable

If the agent crashes / lease expires / network drops, Personal OS lets
the agent resume from the last successful step. Relies on TaskRun +
ActionLog idempotency, which is already in place. Harden phase adds the
"resume" strategy.

### Principle 4: templates, not free-form

Phase 1 does not let the agent invent task types. Only fixed templates:

- Trip planning (fixed 5 steps)
- Link curation (fixed 3 steps)
- Daily capture (fixed 2 steps)

The agent only decides "which template fits this input" — the decision
type least likely to fail. Phase 2 promotes these templates to reusable
Skill objects.

---

## 8. Token Budget Philosophy

First separate what actually burns tokens from what does not:

| Action | Burns? | Note |
|---|---|---|
| Personal OS webhook push | ❌ | plain HTTP |
| Worker polling `/api/agent-inbox` | ❌ | plain HTTP |
| Heartbeat | ❌ | plain HTTP |
| **Agent calls LLM after wake-up** | ✅ **yes** | main cost |
| **Agent reads context and "thinks"** | ✅ **yes** | Wiki candidates inflate prompt |
| **Worker feeds LLM at each execution step** | ✅ **yes** | multi-step cost stacks |

The real question is not "is the push too frequent", but **"does every
push require an LLM call?"** No.

Five throttling strategies:

### Strategy 1: event-driven ≠ LLM-driven

Server-side rules filter events before the agent sees them:

| Event | Rule-only | LLM |
|---|---|---|
| New task, dispatcher busy | enqueue | no |
| New task, nextAction already clear | direct worker claim | no |
| Capture "buy groceries" one-liner | mark as idea | no |
| Capture with date + place + verb | wake dispatcher | yes |
| Clarification user taps a button | rule-based write-back | no |

### Strategy 2: tiered models

One agent does not equal one model:

| Scenario | Model |
|---|---|
| Capture classification | small (mini/haiku/local) |
| Dispatcher routine | GPT-4o-mini |
| Trip planning, long-form | GPT-4o / Claude Sonnet |
| Complex reasoning / error recovery | only when needed: Opus / GPT-5 |

Prompts pin which scenario uses which model. Hermes does not auto-escalate.

Lands in: AgentProfile gains `defaultModel` and `escalationModel`.

### Strategy 3: lazy context loading

`/api/agent/context` returns summaries by default:

- Wiki candidates: title + ~200-char snippet, not full text
- If the agent wants to read a specific one, it fetches it separately
- Dispatcher does not need Wiki candidates during scheduling, only task
  list
- Full Wiki text is only inlined when the worker is about to execute

This cuts average context from ~5k tokens to under 1k.

Lands in: `GET /api/agent/context?expand=wiki_full` returns full content;
the default does not.

### Strategy 4: cache & reuse

- Project state packet cached 24h
- DailyPlan snapshot does not recompute within a day
- Skill definitions (phase 2) inlined into prompt templates, not fetched
  each time

### Strategy 5: throttle + batch

- Dispatcher **does not wake on every event**. Events enqueue; batch runs
  every 5~10 min; `urgent` flag bypasses.
- Worker responds instantly on webhook push; falls back to 5~10 min polling
- Capture bot **uses no LLM on the agent side** (rules are enough); only
  the OS side invokes LLM when strictly needed.

### Cost guardrail

Large tasks (trip planning, long-form) cost a lot per run. Guardrail:

```
Dispatcher: Want me to plan the Tokyo trip? Expected ~2 min, ~$0.05 tokens.
            [Plan] [Work only] [Skip]
```

Gives the user expectation and gives the system a limit.

Lands in: TaskRun records `estimatedCostUsd`; above threshold a
Clarification asks the user first.

### Rough daily cost

(GPT-4o-mini at $0.15/1M in, $0.60/1M out)

| Scenario | Count/day | Tokens/call | Cost/day |
|---|---|---|---|
| Capture (rules) | 20 | 0 LLM | $0 |
| Capture (needs LLM) | 5 | 1k in + 500 out | $0.003 |
| Dispatcher routine | 10 | 3k in + 1k out | $0.01 |
| Clarification decision | 3 | 2k in + 500 out | $0.002 |
| Worker mid-size | 5 | 5k in + 2k out | $0.01 |
| Worker large (GPT-4o) | 1 | 10k in + 3k out | $0.04 |
| Daily plan | 1 | 5k in + 1k out | $0.006 |
| **Total** | | | **~$0.07/day** |

A few dollars a month.

---

## 9. Current State (2026-05-11)

Against the endgame map:

| Module | Status | Note |
|---|---|---|
| Personal OS data skeleton | ✅ mostly complete | Inbox/Task/Idea/Project/TaskRun/ActionLog |
| `/api/intake` unified entry | ✅ usable | writes both sides |
| Agent task execution protocol | ✅ usable | poll/claim/heartbeat/contribute/submit |
| `/api/agent/context` | ✅ usable | returns Wiki candidates |
| `/api/planner/today` `/api/reminders/today` | ✅ usable | schedulable |
| Personal Wiki base (Markdown + search + tag + graph) | ✅ usable | separate service |
| DailyPlan snapshot | ✅ persisted | UI not yet surfaced |
| AgentProfile as first-class identity | 🟡 partial | table exists, not used for routing |
| Event push (OS → Agent) | ❌ missing | **phase 1 core** |
| Clarification object | ❌ missing | **phase 1 core** |
| Telegram button callbacks | ❌ missing | **phase 1 core** |
| User answer write-back + wake | ❌ missing | **phase 1 core** |
| Wiki directory restructure | ❌ missing | **phase 1 core** |
| Wiki learning loop (submit → note) | ❌ missing | **phase 1 core** |
| Workflow / Skill object | ❌ missing | phase 2 |
| Obsidian plugin | ❌ missing | phase 3 |
| Commercial packaging | ❌ missing | phase 3 |

**One line**: the foundation is in place; the circuit is not energized yet;
the vault is still disorganized.

---

## 10. Next Step

Based on this map, phase 1 breaks into two specs that can proceed in
parallel:

- `hermes-multi-agent-wakeup`: wire-up (tracks A + B)
- `wiki-vault-restructure`: Wiki directory, frontmatter, migration (track C)

Both complete → phase 1 success criterion (Tokyo trip scenario) passes.

Each spec goes through `.kiro/specs/` flow for its own requirements and
design.

---

## 11. When to Update This Document

- When you form a new judgment about the product shape
- When a phase closes and the next begins
- When a new constraint shows up (tech path blocked, commercial direction
  shifted)

Do not update it to record implementation detail. That belongs in specs.
This file records product-layer understanding only.
