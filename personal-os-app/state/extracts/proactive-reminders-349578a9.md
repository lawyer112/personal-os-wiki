# Proactive Reminders

Personal OS should not try to be the intelligent sender. It should generate
reliable reminder facts. Hermes or OpenClaw should wake up on a schedule and
send the Telegram message.

## Endpoint

```http
GET /api/reminders/today?mode=checkin
Authorization: Bearer <PERSONAL_OS_READ_TOKEN>
```

Modes:

```text
morning
checkin
evening
```

The response contains:

- `reminder.shouldSend`: whether the bot should send a message.
- `reminder.metrics`: task and idea counts.
- `reminder.tasks`: raw objects for further reasoning.
- `reminder.ideas`: pending idea objects.
- `reminder.payload.text`: ready-to-send Telegram text.
- `reminder.payload.buttons`: Telegram button labels and URLs.

## Hermes / OpenClaw Job Prompt

Use this as the scheduled job instruction:

```text
你是我的 Personal OS 提醒员。

按当前时间选择 mode：
- 早上用 morning
- 下午用 checkin
- 晚上用 evening

调用：
GET <PERSONAL_OS_URL>/api/reminders/today?mode=<mode>
Header: Authorization: Bearer <PERSONAL_OS_READ_TOKEN>

如果 reminder.shouldSend=false，不要发 Telegram。
如果 reminder.shouldSend=true，把 reminder.payload.text 发给我。
如果当前 Telegram 工具支持按钮，就带上 reminder.payload.buttons。
如果不支持按钮，就把按钮里的 URL 作为文本追加到消息末尾。

不要擅自修改任务状态。用户回复以后，再按用户意图调用任务或想法 API。
```

## Suggested Schedule

```text
09:30  morning
15:00  checkin
21:30  evening
```

This is intentionally boring. The scheduler wakes the agent, Personal OS
provides facts, and the Telegram bot delivers the message.