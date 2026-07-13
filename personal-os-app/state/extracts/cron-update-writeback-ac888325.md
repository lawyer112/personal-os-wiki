# cron-update-writeback
Format: JSON
Top-level: object
Size: 5
Nested depth: 9

## Schema

- complete: object (2 keys)
- intake_status: number
- intake_ok: boolean
- inbox_id: string
- agentRunId: string

## Preview

```json
{
  "complete": {
    "status": 200,
    "body": {
      "ok": true,
      "task": {
        "id": "cmqqfl6sh000b0jn5efqev7vt",
        "title": "给自驱执行器加入“无任务时触发 GitHub 雷达”的规则",
        "description": "对象是 cron job b73a310b1a0a 和 GitHub 雷达 job；动作是把“无可执行任务→外部检索→生成任务→执行一个”的闭环写进调度规则；产物是已更新 cron prompt 和一次 dry-run 证据。",
        "status": "done",
        "priority": "P0",
        "riskLevel": "low",
        "executionMode": "agent_allowed",
        "agentTags": [
          "cron",
          "github-radar",
          "agent-self-improvement"
        ],
        "ownerAgent": null,
        "leaseUntil": null,
        "lastHeartbeatAt": null,
        "requiredOutput": "cron prompt 更新记录、一次 context 检索、一次 GitHub 雷达写回或 dry-run 证据。",
        "nextAction": "更新 b73a310b1a0a 与 6733c3aa1cdb 的 prompt，要求雷达产出任务而不是周报链接。",
        "definitionOfDone": "cron list 可见 prompt 已更新；下一轮输出包含“已找/已筛/已转任务/已执行或阻塞原因”，且 Classic 需要做为无。",
        "dueDate": null,
        "estimateMinutes": 60,
        "createdBy": "hermes",
        "createdAt": "2026-06-23T09:17:34.241Z",
        "updatedAt": "2026-06-23T09:20:27.430Z",
        "completedAt": "2026-06-23T09:20:27.426Z",
        "submittedAt": null,
        "projectId": "cmqq290nm00040jmj9jwa98ya",
        "sourceInboxItemId": "cmqqfl5em00000jn5p7wmb0gd",
        "sourceAgentRunId": "cmqqfl5ye00020jn5zg0mimeb",
        "project": {
          "id": "cmqq290nm00040jmj9jwa98ya",
          "name": "Personal OS / Wiki 知识库升级",
          "goal": "让 Personal OS / Personal Wiki 成为 Agent 可稳定调用、可持续吸收新知识、支撑项目落地的外置记忆/RAG 系统。",
          "status": "active",
          "priority": "P0",
…
```