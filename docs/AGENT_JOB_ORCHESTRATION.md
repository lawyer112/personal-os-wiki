# Agent Job Orchestration

This document describes the public, product-level worker pattern. It does not
contain private hostnames, LAN IPs, personal usernames, real agent profiles, or
deployment inventory.

## Goal

Personal OS + Personal Wiki should give agents a shared work surface:

```text
messy input -> classified knowledge/task -> claimable work
  -> agent execution -> evidence -> review -> wiki/project update
```

The system should avoid two failure modes:

- agents relying on stale chat history as the task source of truth;
- agents doing work without leaving a reviewable trace.

## Minimal Worker Set

You do not need many agent identities. Start with one scheduled worker and one
interactive worker. Split later only when permissions or failure domains require
it.

| Worker | Trigger | Main APIs | Permission |
| --- | --- | --- | --- |
| Intake worker | Human sends text/link/file/voice transcript | `POST /api/intake`, Wiki ingest | write token |
| Planning worker | Morning/check-in/evening schedule | `GET /api/planner/today`, `GET /api/reminders/today` | read token |
| Task worker | Polling or manual "delegate to agent" | `GET /api/agent-inbox`, claim/heartbeat/submit | write token |
| Notification adapter | After planner/reminder payload exists | external delivery surface | read token unless it reports evidence |
| Reviewer worker | After a task is submitted | read context, optionally review | read or write token depending on action |

In a small install, the same agent process can run several modes. The important
thing is that each mode has a narrow prompt, narrow schedule, and narrow token.

## Scheduling Model

Recommended first schedule:

```text
09:30 planner-notify   Pull planner packet and send the user a short plan.
15:00 reminder-checkin Pull reminder payload and nudge stale work.
21:30 evening-review   Summarize open loops; do not invent new priorities.
*/30 task-poll         Poll claimable tasks only if the user enabled agent work.
```

The planner job should speak to the user. The task worker should work on a
specific task. Do not mix those two responsibilities in one prompt.

## Task Claim Rules

A worker may claim a task only when all are true:

- the task has matching `agentTags`;
- the task status is claimable;
- the task has a definition of done;
- the action is low-risk or explicitly approved;
- the worker can submit evidence within the lease window.

If the worker is unsure, it should submit a clarification contribution instead
of claiming or mutating the task.

## Permission Tiers

| Tier | Allowed actions | Token |
| --- | --- | --- |
| Read-only | Today, planner, reminders, context, notes | `PERSONAL_OS_READ_TOKEN`, Wiki read token |
| Work execution | claim, heartbeat, contribution, submit | `PERSONAL_OS_API_TOKEN` |
| Knowledge ingestion | create/update Wiki notes | Wiki write token |
| External delivery | Apple Reminders, email, Telegram, Feishu | ideally read token plus external app credential |

Do not give a reminder-only adapter a write token unless it must report delivery
evidence back to Personal OS.

## Worker Prompt Contract

Every worker prompt should state:

1. Which mode it is running in.
2. Which APIs it may call.
3. Which actions are forbidden.
4. What evidence it must submit.
5. When to stop and ask for review.

Use [Agent Prompt](./AGENT_PROMPT.md) as the base prompt and add a small role
patch for the mode.

## Evidence Contract

Every task submission should include at least:

- short summary of what changed;
- artifact URLs or file paths if any;
- Wiki evidence links if knowledge was updated;
- whether the definition of done was met;
- whether a human decision is still needed.

No task should move to "done" only because a notification was delivered.

## Safe Public Deployment Boundary

Public docs must use fictional examples only. Do not publish:

- private LAN IPs;
- real usernames or home paths;
- SSH script paths;
- real agent profile names;
- Telegram bot state;
- real LaunchAgent labels;
- private server inventory;
- customer or business task history.

Keep private operating notes in a private deployment repository or a private
Wiki vault, not in this public source package.
