# Daily Planner

Personal OS does not replace Hermes' intelligence. It prepares the planning
packet. Hermes reads that packet, reasons with GPT, and sends the user a short
plan through Telegram.

## Endpoint

```http
GET /api/planner/today?mode=morning
Authorization: Bearer <PERSONAL_OS_READ_TOKEN>
```

Modes:

```text
morning
checkin
evening
```

The response includes:

- `planner.reminder`: today's task and idea state plus a simple reminder payload.
- `planner.projects`: active/waiting/blocked projects.
- `planner.recentActivity`: latest activity log entries.
- `planner.wiki`: Personal Wiki candidates recalled from tasks, ideas, and projects.
- `planner.plannerInstruction`: the exact role instruction Hermes should follow.

After Hermes turns the packet into the actual user-facing plan, save what was
delivered:

```http
POST /api/planner/today
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
Content-Type: application/json

{
  "mode": "morning",
  "timezone": "Asia/Shanghai",
  "mainLine": "Ship the demo agent review loop.",
  "firstAction": "Run the focused test suite and attach the result.",
  "blocked": [],
  "needsDecision": ["Choose whether this task should be public-facing."],
  "deliveredTo": ["telegram"]
}
```

Read saved snapshots:

```http
GET /api/planner/snapshots?date=2026-05-02&mode=morning
Authorization: Bearer <PERSONAL_OS_READ_TOKEN>
```

The snapshot is the record for "what did the system tell me this morning?" It
is not a task-completion signal.

If `date` is omitted, Personal OS derives it from `timezone`, then
`PERSONAL_OS_TIMEZONE`, then the runtime timezone. Operators who run the service
in Docker or on a remote host should set `PERSONAL_OS_TIMEZONE` or pass
`timezone` explicitly.

`timezone` must be a valid IANA timezone such as `Asia/Shanghai` or `UTC`.
Invalid request values are rejected with `400`; an invalid
`PERSONAL_OS_TIMEZONE` value is ignored and the runtime timezone is used.

## Hermes Prompt

Use this scheduled job instruction:

```text
你是我的 Personal OS 个人助理，不是单纯提醒机器人。

每天定时调用：
GET <PERSONAL_OS_URL>/api/planner/today?mode=<mode>
Header: Authorization: Bearer <PERSONAL_OS_READ_TOKEN>

mode 规则：
- 早上用 morning
- 下午用 checkin
- 晚上用 evening

读取返回的 planner：
- 先读 planner.plannerInstruction
- 再读 planner.reminder.metrics、tasks、ideas
- 再读 planner.projects 和 recentActivity
- 最后看 planner.wiki.candidates

你要做的是帮我规划，不是复读列表。
请根据任务、想法、项目和 Wiki 候选，给我一条 Telegram 消息：
1. 今天主线是什么
2. 建议先做哪 1 到 3 件事
3. 哪些需要我确认
4. 哪些可以暂缓
5. 如果有卡住的事，指出最小下一步

Wiki 候选只是参考，不要把弱相关资料当结论。
如果 planner.wiki.status=unavailable，明确说“知识库暂时取不到”，但仍可基于任务和项目规划。
不要擅自修改任务状态。等我回复后，再调用任务、想法或入库 API。
```

## Reminder vs Planner

`/api/reminders/today` returns a ready-to-send nudge.

`/api/planner/today` returns a richer packet for Hermes to think with.

Use reminders for simple "该做了没有". Use planner for "今天该做什么".
