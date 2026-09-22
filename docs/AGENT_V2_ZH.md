# 智能体第二版接入协议

## 角色与凭证

管理凭证用于人员操作、执行者登记及旧接口兼容，不应交给普通执行器。

服务端通过 `PERSONAL_OS_AGENT_CREDENTIALS` 读取 JSON 数组。每项包含：

```json
[
  {
    "agentId": "docs-worker-01",
    "role": "worker",
    "tokenHash": "填写独立凭证的SHA256十六进制摘要",
    "projectIds": ["允许访问的项目编号"],
    "maxConcurrent": 1
  }
]
```

`tokenHash` 必须是 64 位小写十六进制字符串。凭证原文至少 24 字符，推荐用密码学随机数生成；不要使用上面的说明文字作为凭证。摘要配置只保留在服务端，执行器保留原文。省略 `projectIds` 表示允许访问该身份协议能看到的全部项目；空数组不允许任何项目。

每个执行进程使用独立标识。另建角色为 `reviewer` 的复核身份，不能与该任务的执行者相同。所有身份还必须在智能体中心登记、启用并具有任务写入权限。

所有请求使用 `Authorization: Bearer <独立凭证>`，不接受浏览器 Cookie 代替独立身份。

## 工作循环

```text
GET  /api/agent-v2?action=inbox
POST /api/agent-v2  action=claim, taskId
GET  /api/agent-v2?action=context&taskId=...&runId=...
POST /api/agent-v2  action=heartbeat, taskId, runId
POST /api/agent-v2  action=contribute, taskId, runId, payload
POST /api/agent-v2  action=submit, taskId, runId, payload
```

认领返回 `taskId`、`runId`、租约时间及上下文地址。租约为 5 分钟，后台执行器每 30 秒续约。租约、身份、项目权限与任务策略仍由服务器检查，不能通过修改前端标签获得权限。

进展和提交的 `payload` 可包含：

```json
{
  "summary": "具体完成了什么，以及如何检查",
  "evidenceLinks": ["https://example.invalid/reviewable-evidence"],
  "artifactUrls": ["https://example.invalid/output"],
  "nextRecommendation": "仍需复核的事项",
  "definitionOfDoneMet": true,
  "needsHumanDecision": false
}
```

上述地址只是示例。正式任务应提供可读取且与任务对应的真实证据。系统检查证据链接存在，不代表已经独立检验链接内容，复核者仍需要实际检查。

无法继续时使用 `action=block`，携带 `taskId`、`runId` 和明确的 `reason`。它释放任务租约并记录阻塞，不把工作标记完成。

## 复核循环

复核凭证查询 `action=inbox`，读取待验收任务和当前运行批次。读取该批次的上下文后，提交：

```json
{
  "action": "review",
  "taskId": "任务编号",
  "runId": "当前提交批次",
  "expectedSubmittedAt": "读取到的当前提交时间",
  "payload": {
    "decision": "approve",
    "comment": "检查了哪些证据，为什么符合验收标准"
  }
}
```

决策为 `approve`、`request_changes`、`reject`、`block` 或 `archive`。执行者不能复核自己的成果。当前提交时间或批次改变时返回冲突，需重新检查，不能沿用旧批准。

## 后台执行器

`personal-os-app/scripts/agent-worker.mjs` 是不依赖页面的协议执行器。它不会自动选择模型；管理员配置一个已批准的命令数组，执行命令从标准输入读取任务上下文，在标准输出返回一份结果 JSON，日志写标准错误。

配置项：

```text
PERSONAL_OS_BASE_URL
PERSONAL_OS_WORKER_TOKEN
PERSONAL_OS_WORKER_COMMAND
PERSONAL_OS_WORKER_DIR
PERSONAL_OS_WORKER_ENV
PERSONAL_OS_WORKER_TIMEOUT_MINUTES
PERSONAL_OS_WORKER_POLL_SECONDS
```

命令必须是 JSON 字符串数组，不使用 shell 拼接任务内容。额外环境变量必须显式配置；子进程默认不继承平台凭证。工作目录建议放到 Git 仓库外，执行上下文、日志和产物不应公开。

```bash
node scripts/agent-worker.mjs --once
# 常驻轮询模式：
node scripts/agent-worker.mjs
```

常驻运行应交给管理员配置的进程管理器。授权失效、命令超时、输出过大、缺少知识依据或证据时停止本轮执行。该脚本不审批自己的成果。

## 安全与兼容边界

凭证隔离、行锁及运行批次只能保护本系统的状态写入，不会撤销外部已经执行的命令。生产变更必须有额外审批、工作目录隔离、可中断执行和幂等保护。不要因旧进程心跳消失就盲目重新执行有副作用的任务。

旧接口保留供兼容管理使用。已经拿到管理密钥的执行器仍拥有管理权限，必须更换为独立凭证后才能获得这里描述的角色隔离。

手册缺失、历史版本缺失、来源不足或复核过期都应显式呈现。任务固定版本只覆盖绑定的知识引用，不代表整个项目所有资料已经被冻结。
