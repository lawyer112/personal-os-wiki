# Mac Agent Adapter

This document explains how a Mac-side agent or worker should connect Personal OS
to Apple Reminders, desktop notifications, and other local Mac surfaces.

The Mac is not the source of truth. It is an adapter that nudges the user and
optionally reports delivery evidence back to Personal OS.

## Responsibility Split

```text
Personal OS
  owns tasks, projects, claims, reviews, planner packets, reminder payloads

Personal Wiki
  owns durable knowledge, evidence notes, source summaries

Hermes / scheduler
  decides when to wake up and which mode to request

Mac adapter
  writes Apple Reminders or desktop notifications
  never decides task truth by itself
```

## Required Runtime Configuration

The Mac worker should receive secrets through environment variables or the macOS
keychain. Do not write real tokens into prompts, reminder notes, screenshots, or
Git.

```bash
PERSONAL_OS_BASE_URL=http://localhost:3000
PERSONAL_OS_API_TOKEN=<runtime-write-token>
PERSONAL_OS_READ_TOKEN=<runtime-read-token>
MAC_ADAPTER_ID=mac-reminders-adapter
MAC_REMINDER_LIST="Personal OS"
MAC_REMINDER_TIMEZONE=local
```

Optional:

```bash
PERSONAL_OS_APP_URL=http://localhost:3000
MAC_REMINDER_DRY_RUN=0
MAC_REMINDER_MAX_TASKS=5
```

## Scheduled Jobs

Use a boring, predictable schedule. The scheduler can be `launchd`, cron, a
Hermes job, OpenClaw, or any other local runner.

```text
09:30  mode=morning   decide today's main line
15:00  mode=checkin   nudge unfinished work
21:30  mode=evening   summarize what is still open
```

For planning-quality messages, call:

```http
GET /api/planner/today?mode=<morning|checkin|evening>
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
```

For a simpler ready-to-send nudge, call:

```http
GET /api/reminders/today?mode=<morning|checkin|evening>
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
```

## Write To Apple Reminders

The adapter can use AppleScript, Shortcuts, `remindctl`, or another local
Reminders bridge. The implementation can vary; the contract should not.

### List Selection

Use exactly one configured list, for example `Personal OS`.

If two Apple Reminders lists have the same name, stop and report the problem.
Writing into the wrong duplicate list is worse than not writing.

### Reminder Shape

Create one summary reminder per scheduled run:

```text
Title:
[Personal OS][morning] Review launch checklist

Notes:
source=personal-os
adapter=mac-reminders-adapter
mode=morning
date=2026-04-29
personal_os_url=http://localhost:3000/

Today main line:
Review the launch checklist and attach evidence.

Suggested first action:
Open the task, run the demo, paste the result into the contribution.
```

For high-priority tasks, the adapter may create task-specific reminders:

```text
Title:
[Personal OS][P1] Review launch checklist

Notes:
source=personal-os
task_id=<task-id>
status=todo
personal_os_url=http://localhost:3000/tasks/<task-id>
definition_of_done=<short summary>
```

Do not include tokens, cookies, private server inventory, raw vault paths, or
secret URLs in Apple Reminders.

## Deduplication

The adapter should be idempotent.

Use a stable marker in the reminder notes:

```text
personal_os_reminder_key=personal-os:<mode>:<yyyy-mm-dd>
personal_os_task_key=personal-os-task:<task-id>
```

Before creating a reminder, scan the configured list for the marker. If it
already exists, update the existing reminder instead of creating another one.

## What The Mac Adapter Must Not Do

- Do not treat completing an Apple Reminder as completing the Personal OS task.
- Do not mark a task `done` only because the user checked a reminder.
- Do not create new tasks from notification text unless the user explicitly asks.
- Do not store API tokens in reminder notes or URLs.
- Do not scrape the full Wiki when `/api/planner/today` already provides enough
  context.

Apple Reminders completion means "the nudge was handled." It does not prove the
task's definition of done.

## Optional Feedback To Personal OS

If the adapter supports reporting back, it should write low-risk evidence only:

```text
Delivered morning reminder to Apple Reminders list Personal OS.
Reminder key: personal-os:morning:2026-04-29.
```

Do not change task status from this delivery event. Status changes should happen
through the normal task APIs after user confirmation or reviewer approval.

## Mac Adapter Prompt

Use this as the worker instruction:

```text
You are the Mac notification adapter for Personal OS.

Your job is not to decide task truth. Your job is to deliver Personal OS planner
and reminder payloads to local Mac surfaces such as Apple Reminders or desktop
notifications.

Every scheduled run:
1. Choose mode by time: morning, checkin, or evening.
2. Call GET {PERSONAL_OS_BASE_URL}/api/planner/today?mode={mode}
   with Authorization: Bearer {PERSONAL_OS_API_TOKEN}.
3. Read planner.plannerInstruction, reminder metrics, tasks, projects, recent
   activity, and wiki candidates.
4. Create or update a summary reminder in the configured Apple Reminders list.
5. Optionally create or update task-specific reminders for high-priority tasks.
6. Deduplicate by personal_os_reminder_key and personal_os_task_key.
7. Never write tokens, cookies, private vault paths, or secrets into reminders.
8. Never mark Personal OS tasks done from Apple Reminders completion alone.
9. If the configured reminder list is missing or duplicated, stop and report it.

Output a short delivery report:
- mode
- reminder list
- created count
- updated count
- skipped count
- errors
```

## Smoke Test

1. Verify the Mac worker has `PERSONAL_OS_API_TOKEN`.
2. Call:

   ```bash
   curl -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
     "$PERSONAL_OS_BASE_URL/api/reminders/today?mode=checkin"
   ```

3. Create a dry-run reminder payload without writing to Apple Reminders.
4. Write one test reminder to the configured list.
5. Run the adapter again and confirm it updates the existing reminder instead of
   creating a duplicate.
6. Complete the Apple Reminder and confirm the Personal OS task remains
   unchanged.
7. If all checks pass, enable the scheduled job.

## Product Rule

Mac sync is delivery, not truth.

The task truth stays in Personal OS. The evidence stays in Personal Wiki. The
Mac adapter only makes the work visible at the place where the user is likely to
notice it.
