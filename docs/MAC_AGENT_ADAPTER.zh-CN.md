# Mac Agent Adapter 操作手册

这份文档写给跑在 Mac 上的 Agent、定时 worker 或通知同步脚本。它负责把 Personal OS 的任务规划和提醒，同步到 Apple 提醒事项、桌面通知或其他 Mac 本地入口。

Mac 不是任务真相。Mac 是 adapter，负责提醒用户、展示入口、必要时回报“已投递”证据。

## 职责分工

```text
Personal OS
  管任务、项目、认领、复核、planner 包、reminder payload

Personal Wiki
  管长期知识、证据笔记、来源摘要

Hermes / scheduler
  决定什么时候唤醒，以及这次用 morning / checkin / evening 哪种模式

Mac adapter
  写入 Apple 提醒事项或桌面通知
  不自己决定任务是否完成
```

## 必需运行时配置

Mac worker 应该从环境变量或 macOS keychain 读取密钥。不要把真实 token 写进 prompt、提醒事项备注、截图或 Git。

```bash
PERSONAL_OS_BASE_URL=http://localhost:3000
PERSONAL_OS_API_TOKEN=<runtime-write-token>
PERSONAL_OS_READ_TOKEN=<runtime-read-token>
MAC_ADAPTER_ID=mac-reminders-adapter
MAC_REMINDER_LIST="Personal OS"
MAC_REMINDER_TIMEZONE=local
```

可选：

```bash
PERSONAL_OS_APP_URL=http://localhost:3000
MAC_REMINDER_DRY_RUN=0
MAC_REMINDER_MAX_TASKS=5
```

## 定时任务

保持简单、稳定、可预期。调度器可以是 `launchd`、cron、Hermes job、OpenClaw 或其他本地 runner。

```text
09:30  mode=morning   判断今天主线
15:00  mode=checkin   催办未完成工作
21:30  mode=evening   总结今天还剩什么
```

如果需要更像助理的规划消息，调用：

```http
GET /api/planner/today?mode=<morning|checkin|evening>
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
```

如果只需要简单提醒，调用：

```http
GET /api/reminders/today?mode=<morning|checkin|evening>
Authorization: Bearer <PERSONAL_OS_API_TOKEN>
```

## 写入 Apple 提醒事项

adapter 可以用 AppleScript、快捷指令、`remindctl` 或其他本地 Reminders bridge。实现方式可以不同，但行为契约要一致。

### 列表选择

只写入一个明确配置的列表，例如 `Personal OS`。

如果 Apple 提醒事项里有两个同名列表，停止并报告问题。写进错误的同名列表，比不写更糟。

### 提醒事项格式

每次定时运行创建一条 summary reminder：

```text
标题：
[Personal OS][morning] Review launch checklist

备注：
source=personal-os
adapter=mac-reminders-adapter
mode=morning
date=2026-04-29
personal_os_url=http://localhost:3000/

今日主线：
Review the launch checklist and attach evidence.

建议先做：
Open the task, run the demo, paste the result into the contribution.
```

高优先级任务可以额外创建 task-specific reminder：

```text
标题：
[Personal OS][P1] Review launch checklist

备注：
source=personal-os
task_id=<task-id>
status=todo
personal_os_url=http://localhost:3000/tasks/<task-id>
definition_of_done=<short summary>
```

Apple 提醒事项里不能写 token、cookie、私有服务器台账、真实 vault 路径或秘密 URL。

## 去重规则

adapter 必须幂等。重复运行不能刷出一堆重复提醒。

在备注里写稳定标记：

```text
personal_os_reminder_key=personal-os:<mode>:<yyyy-mm-dd>
personal_os_task_key=personal-os-task:<task-id>
```

创建提醒前，先扫描配置的提醒事项列表。如果 marker 已经存在，就更新原提醒，不要新建。

## Mac adapter 不能做什么

- 不能把“完成 Apple 提醒事项”当成“完成 Personal OS 任务”。
- 不能因为用户勾掉提醒，就把任务标记为 `done`。
- 不能从通知文案自动创建新任务，除非用户明确要求。
- 不能把 API token 写进提醒事项备注或 URL。
- `/api/planner/today` 已经给够上下文时，不要再扫全 Wiki。

Apple 提醒事项的完成，只表示“这条提醒被处理过”。它不能证明任务的 definition of done 已经满足。

## 可选回写 Personal OS

如果 adapter 支持回写，只回写低风险证据：

```text
Delivered morning reminder to Apple Reminders list Personal OS.
Reminder key: personal-os:morning:2026-04-29.
```

不要因为这个投递事件修改任务状态。任务状态变更必须走正常任务 API，并且基于用户确认或 reviewer 通过。

## Mac Adapter 提示词

给 Mac worker / Agent 用这段：

```text
你是 Personal OS 的 Mac 通知 adapter。

你的职责不是判断任务真相，而是把 Personal OS 的 planner/reminder payload 投递到 Mac 本地入口，例如 Apple 提醒事项或桌面通知。

每次定时运行：
1. 根据当前时间选择 mode：morning、checkin 或 evening。
2. 调用 GET {PERSONAL_OS_BASE_URL}/api/planner/today?mode={mode}
   Header: Authorization: Bearer {PERSONAL_OS_API_TOKEN}
3. 读取 planner.plannerInstruction、reminder metrics、tasks、projects、recentActivity 和 wiki candidates。
4. 在配置好的 Apple 提醒事项列表里创建或更新一条 summary reminder。
5. 对高优先级任务，可创建或更新 task-specific reminder。
6. 使用 personal_os_reminder_key 和 personal_os_task_key 去重。
7. 不把 token、cookie、私有 vault 路径或秘密信息写进提醒事项。
8. 不能仅凭 Apple 提醒事项被勾掉，就把 Personal OS 任务标记为 done。
9. 如果配置的提醒事项列表不存在或重名，停止并报告。

输出一段简短投递报告：
- mode
- reminder list
- created count
- updated count
- skipped count
- errors
```

## 冒烟测试

1. 确认 Mac worker 有 `PERSONAL_OS_API_TOKEN`。
2. 调用：

   ```bash
   curl -H "Authorization: Bearer $PERSONAL_OS_API_TOKEN" \
     "$PERSONAL_OS_BASE_URL/api/reminders/today?mode=checkin"
   ```

3. 先 dry-run 生成提醒内容，不写入 Apple 提醒事项。
4. 往配置列表写一条测试提醒。
5. 再跑一次 adapter，确认它更新原提醒，而不是创建重复提醒。
6. 勾掉 Apple 提醒事项，确认 Personal OS 里的任务状态没有变化。
7. 全部通过后，再启用定时任务。

## 产品规则

Mac 同步是投递，不是真相。

任务真相留在 Personal OS。证据留在 Personal Wiki。Mac adapter 只负责把该做的事推到用户更容易看到的地方。
