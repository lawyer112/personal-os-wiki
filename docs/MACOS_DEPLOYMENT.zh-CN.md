# macOS 部署指南

这份文档写的是通用 macOS 部署方式，不是某一台 Mac mini 的私有部署记录。

macOS 适合做个人本地工作站：自己用、Agent 用、Apple 提醒事项同步用。公网生产部署仍然建议看
[Deployment Guide](./DEPLOYMENT.md)：服务绑定 localhost，外面再放带认证的 HTTPS 反向代理。

## 选择部署方式

| 方式 | 适合场景 | 运行方式 | 说明 |
| --- | --- | --- | --- |
| Docker Desktop demo | 先看效果 | Docker Desktop | 一条命令，假数据，demo token。 |
| Docker Desktop 私有部署 | 大多数 Mac 用户 | Docker Desktop | 推荐路线。 |
| Colima 私有部署 | 喜欢 CLI、轻量 Docker | Colima + Docker CLI | 适合开发机或长期在线 Mac。 |
| Homebrew 原生部署 | 已经会维护 Node/Python/Postgres | Homebrew services / launchd | 高级路线，自己负责日志、升级、备份。 |

根目录 `docker compose up -d --build` 是 demo，不是正式个人部署。正式部署必须换自己的 token、备份策略和升级流程。

## Mac 上会跑什么

| 组件 | 默认本地地址 | 数据 |
| --- | --- | --- |
| Personal Wiki | `http://localhost:3422` | Markdown vault 和索引 |
| Personal OS | demo/dev 用 `http://localhost:3000`，prod compose 用 `http://localhost:3100` | Postgres 和附件 |
| Postgres | Docker 内网，或 dev compose 的 `localhost:54329` | 任务、项目、Inbox、Review 状态 |
| Mac adapter | 不暴露端口 | Apple 提醒事项、桌面通知等投递层 |

Personal OS 是任务真相；Personal Wiki 是长期知识和证据；Apple 提醒事项、Telegram、飞书、邮件、桌面通知都只是 adapter。

## 前置条件

建议环境：

- macOS 13 或更新版本。
- Apple Silicon 或 Intel Mac 都可以。
- 4 核 CPU、8GB 内存、20GB 可用磁盘更舒服。
- Git 和 `curl`。
- Docker Desktop 或 Colima。
- 用密码管理器保存 token。

如果没有 Git，先装 Xcode Command Line Tools：

```bash
xcode-select --install
git --version
curl --version
```

### Docker Desktop 路线

安装 Docker Desktop，启动一次，然后检查：

```bash
docker version
docker compose version
```

如果失败，先打开 Docker Desktop，等它显示 Docker Engine 已经运行。

### Colima 路线

先装 Homebrew，然后：

```bash
brew install colima docker docker-compose git curl
colima start --cpu 4 --memory 6 --disk 40
docker version
docker compose version
```

运行服务时保持 Colima 开着：

```bash
colima status
```

### Homebrew 原生路线

不想用 Docker 时才走这个：

```bash
brew install node@24 python@3.12 postgresql@16
node --version
python3 --version
psql --version
```

原生部署更灵活，但进程守护、日志、升级、备份、鉴权边界都要自己负责。

## 跑 demo

```bash
git clone https://github.com/lawyer112/personal-os-wiki.git
cd personal-os-wiki
docker compose up -d --build
```

打开：

```text
Personal OS:   http://localhost:3000/auth/read
Read token:    demo-read-token

Personal Wiki: http://localhost:3422/auth/read
Read token:    demo-wiki-read-token
```

检查：

```bash
docker compose ps
curl -fsS http://localhost:3422/api/health
curl -fsS -H "Authorization: Bearer demo-read-token" http://localhost:3000/api/today
```

停止 demo，不删数据：

```bash
docker compose down
```

确认不要 demo 数据后再删 volume：

```bash
docker compose down -v
```

## 正式私有部署

正式部署建议分别启动 Wiki 和 OS，不要直接沿用根目录 demo token。

### 1. 配置 Personal Wiki

```bash
cd personal-wiki
cp .env.example .env
```

编辑 `personal-wiki/.env`：

```env
WIKI_API_TOKEN="replace-with-a-long-random-write-token"
WIKI_READ_TOKEN="replace-with-a-long-random-read-token"
WIKI_REQUIRE_API_READ_AUTH="1"
WIKI_REQUIRE_PAGE_READ_AUTH="1"
WIKI_TRUST_LOCALHOST_READ_AUTH="0"
WIKI_ALLOW_UNAUTHENTICATED_WRITE="0"
WIKI_SITE_TITLE="Personal Wiki"
WIKI_HOST="127.0.0.1"
WIKI_PORT="3422"
```

Docker 场景下，容器内部会监听 `0.0.0.0`，但宿主机端口绑定在 `127.0.0.1:3422`，默认仍然只允许本机访问。

启动：

```bash
docker compose up -d --build
curl -fsS http://localhost:3422/api/health
```

### 2. 配置 Personal OS

```bash
cd ../personal-os-app
cp .env.prod.example .env
```

编辑 `personal-os-app/.env`：

```env
POSTGRES_PASSWORD="replace-with-a-long-random-database-password"
PERSONAL_OS_API_TOKEN="replace-with-a-long-random-write-token"
PERSONAL_OS_READ_TOKEN="replace-with-a-long-random-read-token"
WIKI_READ_TOKEN="same-as-personal-wiki-read-token"
WIKI_API_TOKEN="same-as-personal-wiki-write-token"
NEXT_PUBLIC_APP_URL="http://localhost:3100"
NEXT_PUBLIC_WIKI_URL="http://localhost:3422"
```

启动：

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl -fsS -H "Authorization: Bearer $PERSONAL_OS_READ_TOKEN" http://localhost:3100/api/today
```

打开：

```text
Personal OS:   http://localhost:3100/auth/read
Personal Wiki: http://localhost:3422/auth/read
```

## macOS 网络边界

`localhost` 只代表这台 Mac。如果 Windows、另一台 Mac、手机或远端 Agent 要访问，不要随手把端口改成 `0.0.0.0`。

| 需求 | 建议 |
| --- | --- |
| 只在这台 Mac 上用 | 保持 `127.0.0.1`。 |
| 局域网另一台可信机器访问 | 优先 SSH tunnel。 |
| 局域网浏览器访问 | 用带认证的反向代理。 |
| 公网访问 | HTTPS、认证、最小暴露面、备份恢复都要补齐。 |

不要把 `3000`、`3100`、`3422` 直接通过路由器映射到公网。

## 可选：接 Mac Agent Adapter

Mac adapter 不是必需服务。它只负责把 Personal OS 的 planner/reminder payload 投递到 Apple 提醒事项、桌面通知等本地入口。

prod compose 本机部署：

```bash
export PERSONAL_OS_BASE_URL="http://localhost:3100"
export PERSONAL_OS_READ_TOKEN="<personal-os-read-token>"
export PERSONAL_OS_API_TOKEN="<personal-os-write-token>"
export MAC_ADAPTER_ID="mac-reminders-adapter"
export MAC_REMINDER_LIST="Personal OS"
```

根目录 demo：

```bash
export PERSONAL_OS_BASE_URL="http://localhost:3000"
export PERSONAL_OS_READ_TOKEN="demo-read-token"
export PERSONAL_OS_API_TOKEN="demo-write-token"
```

如果 Personal OS 跑在远端服务器，用 HTTPS 地址或 SSH tunnel 地址。不要以为 Mac 上的 `localhost` 会自动指向另一台机器。

继续看：

- [Mac Agent Adapter 操作手册](./MAC_AGENT_ADAPTER.zh-CN.md)
- [Agent 使用手册](./AGENT_GUIDE.zh-CN.md)

## launchd 安全模式

不要把 token 直接写进 LaunchAgent plist。优先用 macOS Keychain，或者用仓库外的私有 env 文件。

如果用 env 文件：

```bash
mkdir -p "$HOME/.config/personal-os"
touch "$HOME/.config/personal-os/agent.env"
chmod 600 "$HOME/.config/personal-os/agent.env"
```

示例 `agent.env`：

```bash
PERSONAL_OS_BASE_URL=http://localhost:3100
PERSONAL_OS_READ_TOKEN=replace-with-read-token
PERSONAL_OS_API_TOKEN=replace-with-write-token
MAC_ADAPTER_ID=mac-reminders-adapter
MAC_REMINDER_LIST=Personal OS
```

LaunchAgent 只调用 wrapper script，由 wrapper script 读取这个 env 文件。日志放在私有目录；如果日志里有任务摘要，要定期清理。

## 备份

升级前先备份。

根目录 demo compose：

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U personal_os -d personal_os > backups/personal_os_$(date +%Y%m%d).sql
docker compose exec -T personal-wiki tar -czf - /data > backups/personal_wiki_data_$(date +%Y%m%d).tgz
```

component Wiki compose 使用 `./data:/data`：

```bash
mkdir -p backups
tar -czf backups/personal_wiki_data_$(date +%Y%m%d).tgz -C personal-wiki data
```

Personal OS prod compose：

```bash
cd personal-os-app
mkdir -p ../backups
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U personal_os -d personal_os > ../backups/personal_os_$(date +%Y%m%d).sql
```

`.env` 里的 token 存到密码管理器，不要放进 Git，也不要放到公开网盘。

## 升级

1. 备份 Wiki 数据和 Postgres。
2. 停掉会写提醒或任务的 worker job。
3. 切到新 release tag，或解压新 release 包。
4. 放回自己的 `.env`。
5. 重新构建并启动：

   ```bash
   docker compose up -d --build
   ```

   或者 OS prod compose：

   ```bash
   cd personal-os-app
   docker compose -f docker-compose.prod.yml up -d --build
   ```

6. 跑健康检查和 smoke test。
7. 重新启用 worker job。

## 故障排查

### Docker 没启动

```bash
docker info
```

启动 Docker Desktop，或执行 `colima start`。

### 端口被占

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3100 -sTCP:LISTEN
lsof -nP -iTCP:3422 -sTCP:LISTEN
```

停止冲突服务，或改 compose 的宿主机端口。

### Wiki 要求登录

用 `WIKI_READ_TOKEN` 打开：

```text
http://localhost:3422/auth/read
```

### Personal OS 链接跳错端口

prod compose 用：

```env
NEXT_PUBLIC_APP_URL="http://localhost:3100"
```

dev 模式用：

```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### planner/reminder API 返回 401

这些是只读接口，用 read token：

```bash
curl -H "Authorization: Bearer $PERSONAL_OS_READ_TOKEN" \
  "$PERSONAL_OS_BASE_URL/api/planner/today?mode=morning"
```

write token 只给写入、认领、心跳、提交、复核和 intake 用。

### Apple 提醒事项写不进去

检查 macOS 隐私与安全性里的 Reminders、Automation 权限。确认配置的提醒事项列表只存在一个同名列表。

## macOS 安全清单

- 替换所有 demo token 和 placeholder token。
- read token 和 write token 分开。
- 默认保持 `127.0.0.1`，需要外部访问时用带认证的反向代理。
- 不要直接把原始端口暴露到公网。
- 不要把 token 写进 LaunchAgent plist、提醒事项备注、URL 或截图。
- 不要提交 `.env`、`personal-wiki/data`、Postgres dump、日志、提醒事项、真实任务历史。
- 如果用反向代理，Personal OS 和 Wiki 尽量用专用 hostname；不要和不可信应用混在同一个 hostname 下。
