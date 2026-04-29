# 部署指南

这个项目可以按三种方式运行：

| 模式 | 适合谁 | 运行内容 |
| --- | --- | --- |
| Docker Compose | 大多数用户、小型私有服务器 | Personal Wiki 容器、Postgres 容器、可选 Personal OS 容器 |
| 本地开发 | 要改代码、跑测试、调 UI 的人 | Wiki 用 Docker 或 Python，Postgres 用 Docker，Personal OS 用 `npm run dev` |
| 裸 Linux 服务 | 已经会维护 systemd、反向代理和备份的运维用户 | Python Wiki 服务、Node/Next.js 服务、外部 Postgres |

推荐公开模板：Linux 主机 + Docker Compose + localhost 绑定 + 带鉴权的反向代理。
不要把原始 app 端口直接暴露到公网。

普通安装建议从固定 GitHub Release 或版本 tag 开始。`main` 更适合贡献者和审查者，不适合当作稳定个人部署入口。见：[版本发布与安装包](./RELEASES.zh-CN.md)。

## 会部署哪些组件

| 组件 | 运行时 | 默认端口 | 持久化数据 |
| --- | --- | --- | --- |
| Personal Wiki | Python 3.12 容器，或 Python 3.11+ 裸运行时 | `3422` | `personal-wiki/data` 或 `WIKI_DATA_DIR` |
| Personal OS | Next.js 16 / Node.js 24+ | 开发环境 `3000`，生产 compose `3100 -> 3000` | Postgres 和 `personal_os_data` volume |
| Postgres | PostgreSQL 16 | 本地开发 compose `54329`，生产 compose 内部 `5432` | `personal_os_postgres` volume |

Personal Wiki 可以单独运行。Personal OS 需要 Postgres。完整 OS/Wiki 闭环需要两个服务都运行，并且 Wiki 的读写 token 对齐。

## 推荐机器配置

单人私有部署的最低建议：

| 资源 | 最低 | 更舒服 |
| --- | --- | --- |
| CPU | 2 核 | 4 核 |
| 内存 | 2 GB | 4-8 GB |
| 磁盘 | 10 GB 可用空间 | 20+ GB，并预留备份空间 |
| 系统 | Linux x86_64、macOS、或 Windows + WSL2/Docker Desktop | Ubuntu/Debian 服务器 |

应用本身很轻。真正占空间的是 Markdown vault、附件、截图和 Postgres 历史数据。

## 必装工具

推荐 Docker 路线：

- Docker Engine 或 Docker Desktop。
- Docker Compose v2。
- Git。
- `curl`，用于健康检查。
- 密码管理器或 secret manager，用来保存 token 和数据库密码。

本地开发路线：

- Node.js 24 或更新版本。
- npm，随 Node.js 安装。
- 如果不用 Docker 跑 Wiki，需要 Python 3.11 或更新版本。
- Docker Compose，用来启动本地 Postgres。

偏生产的 Linux 部署：

- Docker Engine 和 Compose v2，或者 Node.js 24 + Python 3.11+。
- PostgreSQL 16。
- Caddy、Nginx、Traefik 或 Cloudflare Tunnel 这类反向代理。
- 公开访问必须有 HTTPS 和鉴权层。
- Postgres 和 Wiki 数据的备份自动化。

## 端口和网络边界

| 端口 | 服务 | 默认暴露方式 |
| --- | --- | --- |
| `3422` | Personal Wiki | 只建议本地/demo 使用；公网必须放在鉴权和反向代理后面 |
| `3000` | Personal OS 开发服务 | 只用于本地开发 |
| `3100` | Personal OS 生产 compose 主机端口 | 默认绑定 `127.0.0.1` |
| `54329` | 本地开发 Postgres | 绑定 `127.0.0.1` |
| `5432` | Docker 网络内 Postgres | 生产 compose 内部访问 |

安全默认值：app 端口只绑定 localhost；真正对外发布的是带 TLS 和鉴权的反向代理 URL。

## 必要环境变量

Personal Wiki：

```env
WIKI_API_TOKEN="replace-with-a-long-random-write-token"
WIKI_READ_TOKEN="replace-with-a-long-random-read-token"
WIKI_REQUIRE_API_READ_AUTH="1"
WIKI_REQUIRE_PAGE_READ_AUTH="1"
WIKI_TRUST_LOCALHOST_READ_AUTH="0"
WIKI_ALLOW_UNAUTHENTICATED_WRITE="0"
WIKI_SITE_TITLE="Personal Wiki"
WIKI_HOST="0.0.0.0"
WIKI_PORT="3422"
```

Personal OS：

```env
DATABASE_URL="postgresql://personal_os:replace-with-a-long-random-database-password@localhost:54329/personal_os?schema=public"
PERSONAL_OS_API_TOKEN="replace-with-a-long-random-write-token"
PERSONAL_OS_READ_TOKEN="replace-with-a-long-random-read-token"
WIKI_READ_TOKEN="replace-with-your-personal-wiki-read-token"
WIKI_API_TOKEN="replace-with-your-personal-wiki-token"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_WIKI_URL="http://localhost:3422"
```

读 token 和写 token 要分开。不要把 Wiki 写 token 用作浏览器 handoff 或只读 Agent 访问。

## 快速部署路径

### 从 Release 包开始

下载并解压：

```text
personal-os-wiki-v0.1.1.zip
personal-os-wiki-v0.1.1.tar.gz
```

或者按固定 tag 克隆：

```bash
git clone --branch v0.1.1 https://github.com/lawyer112/personal-os-wiki.git
cd personal-os-wiki
```

然后继续选择下面的 Wiki-only、本地完整环境或偏生产 compose 路径。

### 只部署 Wiki

```bash
cd personal-wiki
cp .env.example .env
# 修改 WIKI_API_TOKEN 和 WIKI_READ_TOKEN
docker compose up -d --build
curl http://localhost:3422/api/health
```

### 完整本地开发环境

```bash
cd personal-wiki
cp .env.example .env
docker compose up -d --build

cd ../personal-os-app
cp .env.example .env
docker compose up -d postgres
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

打开：

- Personal Wiki：`http://localhost:3422`
- Personal OS：`http://localhost:3000`

### 偏生产的 Personal OS compose

```bash
cd personal-os-app
cp .env.example .env
# 设置 POSTGRES_PASSWORD、PERSONAL_OS_API_TOKEN、PERSONAL_OS_READ_TOKEN、
# WIKI_READ_TOKEN、WIKI_API_TOKEN、NEXT_PUBLIC_APP_URL、NEXT_PUBLIC_WIKI_URL
docker compose -f docker-compose.prod.yml up -d --build
```

生产 compose 默认把 Personal OS 绑定到 `127.0.0.1:3100`。应该在前面放反向代理，不要直接开放容器端口。

## 对外暴露前检查

- 替换所有 `replace-with-*` 和 `change-me`。
- `.env`、Wiki vault、Postgres 数据、日志、截图都不能进 Git。
- 服务保持 localhost 绑定，除非反向代理已经提供 TLS 和鉴权。
- 保持 `WIKI_TRUST_LOCALHOST_READ_AUTH=0`，除非你确认所有 localhost
  调用者都可信；同机反向代理转发到 Wiki 时也会表现为 localhost。
- Personal OS 和 Personal Wiki 都使用分离的读写 token。
- 升级前备份 Postgres 和 Wiki 数据。
- 不只要创建备份，还要测试恢复。
- 不发布服务器台账、内网地址、真实项目映射或业务敏感任务历史。

## 备份目标

至少备份：

- `personal-wiki/data`，或 `WIKI_DATA_DIR` 指向的目录。
- Personal OS 使用的 Postgres 数据库。
- `.env` 值通过密码管理器或 secret manager 保存，不通过 Git 保存。

Docker volume 场景下，Postgres 用 `pg_dump`，Wiki 数据目录用普通文件备份。

## Docker 不是硬性要求

Docker 不是必须的。推荐 Docker 是因为它能减少安装漂移，让 Postgres、Python、Node 版本更可控。

如果你已经会维护 Linux 服务，可以这样跑：

- Personal Wiki：作为 Python 服务运行，配置 `WIKI_*` 环境变量。
- Personal OS：`npm ci`、`npm run prisma:generate`、`npm run build`、`npm run start:prod`。
- Postgres：使用系统包、托管数据库或独立容器。

裸部署更灵活，但进程守护、升级、日志、TLS、鉴权和备份都要自己负责。

## 继续阅读

- [快速上手](./GETTING_STARTED.zh-CN.md)
- [数据安全](./DATA_SAFETY.zh-CN.md)
- [仓库权限](./PERMISSIONS.md)
- [Personal OS README](../personal-os-app/README.md)
- [Personal Wiki README](../personal-wiki/README.md)
