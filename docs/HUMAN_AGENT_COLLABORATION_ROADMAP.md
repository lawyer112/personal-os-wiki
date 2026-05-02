# Human-Agent Collaboration Roadmap

Personal OS + Personal Wiki is not only a knowledge base. The product direction
is a human-agent collaboration workbench:

```text
messy human input
  -> durable knowledge
  -> explicit tasks
  -> agent claim and execution
  -> evidence and review
  -> updated knowledge and project state
```

This document records the engineering gaps that still prevent the system from
feeling like a reliable assistant rather than a passive task board.

## Current State

Already implemented:

- Inbox records original user input.
- `/api/intake` can create Inbox, AgentRun, Wiki notes, OS notes, tasks, ideas,
  project events, and notification payloads in one call.
- Tasks have `nextAction`, `definitionOfDone`, priority, risk level,
  `executionMode`, agent tags, owner agent, lease, heartbeat, contributions,
  artifacts, and reviews.
- Agent profiles can register tags, capabilities, risk limits, task-write
  permission, Wiki-write permission, notification permission, and enabled state.
- Agents can poll, claim, heartbeat, contribute, submit, and wait for review.
- Agent polling, claiming, heartbeat, contribution, and submit now respect task
  execution mode, risk level, active leases, and profile tags/permissions.
- `/api/agent/context` returns task context, Wiki candidates, related ideas,
  recent tasks, activity, and execution policy.
- `/api/planner/today` and `/api/reminders/today` provide packets for scheduled
  workers and notification adapters.
- Daily planner output can be saved as `DailyPlan` snapshots so the delivered
  plan is inspectable later.
- Personal Wiki stores durable Markdown knowledge and source evidence.

The missing layer is not another chat memory. The missing layer is decision and
execution control: what should be done now, which agent is allowed to do it,
what evidence proves it moved, and how the result changes the knowledge base.

## Key Gaps

| Gap | Why it matters |
| --- | --- |
| Intake quality is agent-dependent | The server validates fields, but it does not grade whether a task is concrete or whether knowledge should remain knowledge-only. |
| No first-class workflow/skill object | Reusable work methods live in docs or Wiki prose, not as versioned, callable execution recipes. |
| Daily plan snapshot needs UI surfacing | Planner snapshots are persisted, but they are not yet shown on the Today page. |
| Execution policy is still coarse | `executionMode` blocks unsafe claims, but there is not yet a full approval workflow for changing modes. |
| Agent capability registry is minimal | Profiles can filter work, but the UI and richer capability matching are not complete. |
| Agent execution is not a first-class run | `AgentRun` currently models intake classification more than task execution attempts. |
| No work queue scheduling policy | Polling exists, but there is no ranking rule for what a worker should claim first beyond query order. |
| Review is status-level, not criteria-level | A reviewer can approve/reject, but the system does not store checklist items or evidence requirements per task type. |
| Notification delivery is not closed-loop | Notification payloads exist, but delivery adapters and delivery evidence are still external. |
| Wiki learning loop is incomplete | Task results can link Wiki evidence, but approved outcomes are not automatically proposed as Wiki updates or workflow improvements. |

## Product Model

The system should treat human-agent collaboration as five linked objects:

| Object | Job |
| --- | --- |
| Source | What the human or external tool actually provided. |
| Knowledge | Stable facts, project context, decisions, workflows, and evidence. |
| Task | A concrete action with next step and definition of done. |
| Execution | A claimed run by an agent with lease, heartbeat, actions, artifacts, and evidence. |
| Review | A decision that accepts, rejects, blocks, or turns results back into knowledge. |

## Proposed Additions

### 1. Intake Decision Schema

Add a stricter classification object to `/api/intake`:

```json
{
  "inputType": "knowledge_only | idea | project_update | user_task | agent_task | question_answer | noise",
  "actionability": "none | later | today | agent_claimable",
  "confidence": 0.0,
  "why": "short reason",
  "missingInformation": ["..."],
  "safetyNotes": ["..."]
}
```

This makes the system stop turning every thought into a task.

### 2. Execution Mode

Add a task execution mode:

```text
manual
agent_suggested
agent_allowed
approval_required
blocked_until_user
```

`riskLevel` says how dangerous the task is. `executionMode` says what the agent
is allowed to do.

### 3. Agent Capability Registry

Add an agent registry:

```text
AgentProfile
- id
- displayName
- tags
- capabilities
- allowedRiskLevel
- canWriteWiki
- canWriteTasks
- canTouchFiles
- canSendNotifications
- enabled
```

Task polling currently matches task tags, execution mode, risk level, and core
profile permissions. `capabilities` is stored as metadata for the next scheduler
phase and is not yet a hard execution constraint.

### 4. Task Execution Run

Add a first-class execution run separate from intake `AgentRun`:

```text
TaskRun
- id
- taskId
- agentId
- status: claimed | running | submitted | failed | expired | cancelled
- leaseUntil
- startedAt
- completedAt
- summary
- error
```

`TaskClaim`, `TaskContribution`, and `TaskArtifact` can remain, but `TaskRun`
becomes the central record for "what this agent attempted."

### 5. Action Log

Add a structured action log for agent work:

```text
AgentActionLog
- taskRunId
- actionType
- toolName
- target
- summary
- riskLevel
- beforeState
- afterState
- artifactUrls
- createdAt
```

This is what lets the user see "what the assistant actually did" instead of
only reading a final summary.

### 6. Workflow/Skill Notes

Treat mature workflows as reusable knowledge:

```text
WorkflowSkill
- title
- purpose
- triggerWhen
- inputs
- steps
- tools
- verification
- failureModes
- lastReviewedAt
- wikiNotePath
```

Examples: "OCR pipeline evaluation", "GitHub release process", "Mac reminder
delivery", "server inventory curation". These are not just docs; they are
operating procedures agents can read before acting.

### 7. Daily Plan Snapshot

Persist the selected plan:

```text
DailyPlan
- date
- mode
- mainLine
- firstAction
- blocked
- needsDecision
- sourcePlannerPacket
- deliveredTo
- createdAt
```

The user should be able to ask: "What did the system tell me to do this
morning, and did I do it?"

### 8. Review Criteria

Add criteria to tasks or task types:

```text
ReviewCriterion
- taskId
- label
- requiredEvidence
- passed
- reviewerComment
```

This prevents vague "looks good" reviews and makes autonomous work safer.

## Implementation Order

1. Done: tighten task claim/heartbeat/contribution ownership rules.
2. Done: add `executionMode` to tasks and block high-risk auto-claims.
3. Done: add `AgentProfile` and profile/tag/risk-aware agent inbox filtering.
4. Done: add `DailyPlan` snapshots for planner output.
5. Add `TaskRun` for task execution attempts.
6. Add structured `AgentActionLog`.
7. Add intake decision schema and quality scoring.
8. Add workflow/skill notes and link them into agent context.
9. Add notification delivery records for Mac/Telegram/Feishu adapters.
10. Add review criteria and reviewer dashboards.

## Near-Term Acceptance Criteria

The next product milestone should prove this scenario:

```text
User drops an OCR idea/source into the system.
Agent classifies it as project knowledge plus one agent-claimable task.
The task links to the OCR workflow skill and evidence notes.
An eligible worker claims it.
The worker evaluates the OCR source, logs actions, and submits evidence.
The reviewer approves or requests changes.
The result updates the project note and workflow skill.
The next daily plan uses that updated knowledge.
```

If that loop works, the system is no longer a passive Wiki. It becomes an
assistant workbench.
