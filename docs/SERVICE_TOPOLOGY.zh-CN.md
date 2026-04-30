# 服务拓扑说明

Personal OS + Personal Wiki 是一个产品包，但不是一个单体 Web 进程。

这个仓库发布的是一套完整系统：

```text
Personal OS + Personal Wiki 仓库 / Release 包
  |
  +-- Personal OS     Next.js 应用和 API，负责工作状态
  +-- Personal Wiki   Python 应用和 API，负责 Markdown 知识库
  +-- Postgres        Personal OS 使用的数据库
```

完整闭环需要三个组件都运行。只想用 Wiki 的人，可以只启动 Personal Wiki。

## 一个下载包，多个运行服务

用户不需要下载两个互不相关的项目。公开仓库和 Release 压缩包里同时包含
Personal OS 和 Personal Wiki。

Demo 路线是一条命令启动整套系统：

```bash
docker compose up -d --build
```

这个命令会启动：

| 运行组件 | 用途 | Demo 地址 |
| --- | --- | --- |
| Personal OS | Inbox、任务、项目、Agent 运行记录、复核、提醒、网页采集 | `http://localhost:3000` |
| Personal Wiki | Markdown vault、笔记、标签、概念、图谱、Wiki 页面 | `http://localhost:3422` |
| Postgres | Personal OS 数据库 | Docker 内网，开发端口 `54329` |
| `personal-os-seed` | 一次性的虚构 demo 数据初始化 | 初始化后退出 |

所以看到两个浏览器地址是正常的。它们是同一个产品栈里的两个服务。

## 为什么不是一个 Web 服务？

Personal OS 和 Personal Wiki 的数据边界不同：

| 层 | 负责 | 不应该负责 |
| --- | --- | --- |
| Personal OS | 工作状态：Inbox、任务、认领、复核、项目事件、通知 | 长篇 Markdown vault 渲染 |
| Personal Wiki | 长期知识：Markdown 笔记、链接、标签、概念、图谱数据 | 任务真相、任务归属、复核决定 |

拆成两个服务有几个好处：

- Personal OS 可以升级或替换，不影响 Wiki vault。
- Personal Wiki 可以脱离 OS，单独作为私有 Markdown 知识库运行。
- Agent 可以分别使用 OS 的任务协议和 Wiki 的知识 API。
- 鉴权边界更清楚：OS 的读写 token 和 Wiki 的读写 token 不是一回事。

## 两者怎么联动？

Personal OS 通过环境变量找到 Personal Wiki：

```env
NEXT_PUBLIC_WIKI_URL="http://localhost:3422"
WIKI_READ_TOKEN="replace-with-your-wiki-read-token"
WIKI_API_TOKEN="replace-with-your-wiki-write-token"
```

联动分两类：

| 路径 | 方向 | 发生什么 |
| --- | --- | --- |
| 浏览器链接 | Personal OS UI -> Personal Wiki UI | OS 页面生成跳转到 Wiki 的链接，用来阅读笔记或打开 Wiki。 |
| 服务端 API | Personal OS API -> Personal Wiki API | OS 的 intake/context 等接口可以用配置好的 Wiki token 读写 Wiki。 |

当前 Personal OS 不会把 Personal Wiki 页面代理成自己的 `/wiki/*` 内部路由。
Wiki 仍然是独立 HTTP 服务。

## 端口怎么理解？

| 模式 | Personal OS | Personal Wiki | Postgres |
| --- | --- | --- | --- |
| 根目录 demo compose | `127.0.0.1:3000` | `127.0.0.1:3422` | `127.0.0.1:54329` |
| OS 生产 compose | `127.0.0.1:3100 -> 3000` | 通常是 `127.0.0.1:3422` | Docker 内部 `5432` |
| 本地开发 | `localhost:3000`，通过 `npm run dev` | `localhost:3422`，通过 Docker 或 Python | `localhost:54329` |

不要把这些原始端口直接暴露到公网。

## 反向代理怎么放？

远程私有访问或公网访问时，建议原始服务仍然只绑定 localhost，对外只发布带
HTTPS 和鉴权的入口。

推荐结构：

```text
https://os.example.internal     -> 127.0.0.1:3100
https://wiki.example.internal   -> 127.0.0.1:3422
```

这样用户看到的是稳定 URL，但服务边界仍然清楚。

不建议默认使用路径代理，例如 `https://example.internal/os` 和
`https://example.internal/wiki`。除非两个应用都专门配置并测试了子路径部署，
否则资源路径、鉴权跳转或内部链接都可能出问题。先用两个 hostname。

## 给新用户的一句话

可以这样解释：

> 下载一个仓库，运行一套 compose。它会启动两个 Web 服务：
> Personal OS 管任务和 Agent 工作状态，Personal Wiki 管 Markdown 长期知识。
> 本地用两个端口访问；正式部署时用反向代理给它们两个稳定的私有 HTTPS 地址。

如果只要 Markdown 知识库，可以只运行 Personal Wiki。如果要完整的 Agent 工作闭环，
就需要 Personal OS、Personal Wiki 和 Postgres 都运行。
