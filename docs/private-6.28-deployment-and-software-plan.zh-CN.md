# Personal OS / Personal Wiki 6.28 部署与软件化方案

日期：2026-05-20

## 结论

当前目标不是把公开仓库直接上线，也不是先做桌面软件外壳。

正确顺序是：

1. 先把私有仓库新版固定成可回滚代码点。
2. 在 `192.168.6.28` 做一个不覆盖旧数据的预览部署，让新版 OS/Wiki 能被打开和验证。
3. 通过备份和迁移脚本把真实 Wiki/OS 数据接进新版。
4. 等 Web 版部署稳定后，再做“软件化”：安装器 / 桌面启动器 / 托盘外壳。

## 当前已知事实

- 私有代码点：`fc3e758 Sync private wiki vault restructure`。
- 远端分支：`private-review/codex/release-0.2.0-agent-audit`。
- `192.168.6.28` 可 SSH，用户是 `qihuo`，家目录是 `/home/qihuo`。
- `.28` 当前已有 Docker Engine 和 Docker Compose v2。
- `.28` 当前可用 Node 24：`/home/qihuo/apps/node24/bin/node`。
- `.28` 当前没有 Personal OS / Personal Wiki 部署目录。
- `.28` 当前未占用 `3000`、`3100`、`3422`；已有 `cyber-store` 在 `3002`。
- `.28` 磁盘空间足够：根分区约 490G，剩余约 234G。

## 不丢数据原则

- 代码先保存在私有 GitHub 分支，再做任何服务器动作。
- 部署新版时先用新目录、新 compose project、新 Docker volume 或显式 runtime 目录。
- 不直接覆盖旧的 Wiki vault、Postgres volume、`.env`、日志和附件目录。
- 真实数据迁移前必须先做：
  - Wiki 数据目录 tar 备份。
  - Personal OS Postgres `pg_dump` 或 volume 快照。
  - `.env` 手工保存到服务器私有位置，不进 Git。
- 迁移脚本先 `--dry-run`，确认 report，再 `--apply --yes`。

## 第一阶段：6.28 预览部署

目的：先看到新版界面和新版 API 闭环，不碰真实数据。

建议路径：

```text
/home/qihuo/apps/personal-os-wiki/
  releases/<commit>/
  current -> releases/<commit>
  runtime/
    wiki-data/
    os-data/
    backups/
    env/
```

预览部署方式：

- 从本地已验证的私有提交打包上传，或让服务器拉取私有分支。
- 使用独立 compose project，例如 `personal-os-wiki-preview`。
- Wiki 绑定 `127.0.0.1:3422`。
- OS 生产入口绑定 `127.0.0.1:3100`，或 demo 入口绑定 `127.0.0.1:3000`。
- 从 Windows 通过 SSH tunnel 查看：

```powershell
ssh -L 3100:127.0.0.1:3100 -L 3422:127.0.0.1:3422 192.168.6.28
```

然后打开：

```text
http://127.0.0.1:3100
http://127.0.0.1:3422/auth/read
```

预览验收：

- `GET /api/health` 可用。
- Personal OS 首页、Today、Projects、Tasks、Wiki 页面能打开。
- Task submit 能写入 Personal Wiki summary。
- Wiki 新 ingest frontmatter、MOC、tag registry 逻辑可用。
- 所有数据都在 preview runtime 下，删除 preview 不影响旧系统。

## 第二阶段：接入真实数据

真实数据应该从现有实际运行源确认后再迁移。历史记录显示旧 Personal Wiki / OS 曾在 `.42`：

- Personal Wiki：`192.168.6.42:3422`
- Personal OS：`192.168.6.42:3100`
- Wiki 数据路径曾是 `/home/tun1/personal-wiki/data`

执行顺序：

1. 只读确认 `.42` 当前服务和数据路径。
2. 在 `.42` 备份 Wiki data、OS 数据库、运行时 env。
3. 拷贝备份到 `.28` 的 `runtime/backups/`。
4. 在 `.28` 解压到 preview runtime。
5. 对 Wiki vault 运行：

```bash
python personal-wiki/scripts/migrate_vault.py --dry-run --vault runtime/wiki-data/vault
python personal-wiki/scripts/migrate_vault.py --apply --yes --vault runtime/wiki-data/vault
python personal-wiki/scripts/migrate_pending_harden.py --dry-run --vault runtime/wiki-data/vault
python personal-wiki/scripts/migrate_pending_harden.py --apply --yes --vault runtime/wiki-data/vault
```

6. 重建 Wiki public index / graph / MOC。
7. 对 OS 数据库执行 Prisma migration。
8. 通过 API 和浏览器做回归验证。

## 第三阶段：稳定部署形态

推荐稳定形态：

```text
Browser / desktop shell
        |
        v
HTTPS / auth reverse proxy
        |
        +--> 127.0.0.1:3100  Personal OS
        +--> 127.0.0.1:3422  Personal Wiki
        |
        +--> internal Docker network Postgres
```

原则：

- 对外只暴露反向代理，不直接暴露 app 端口。
- OS/Wiki 继续作为两个 Web 服务运行；这是产品包内部结构，不是用户心智上的两个软件。
- 运行时数据独立于 release 目录。
- 每次升级都走 `releases/<commit>` + `current` symlink + backup + health check。

## 软件化方向

短期不做重桌面客户端。先做“本地服务器软件化”：

### 形态 A：私有服务器应用

适合当前 `.28`：

- 一套 install/update/backup/rollback 脚本。
- Web UI 从浏览器打开。
- 桌面或手机只作为访问端。

这是第一优先级。

### 形态 B：桌面启动器

适合 Windows 单机用户：

- 一个小启动器负责启动 Docker Compose 或远程 SSH tunnel。
- 自动打开 `http://127.0.0.1:3100`。
- 提供状态、停止、备份按钮。

可以先用 PowerShell/WinUI/Tauri 做轻外壳，不把业务逻辑搬进桌面端。

### 形态 C：完整 Electron/Tauri 客户端

后置。只有在 Web 版稳定、安装/升级/备份路径稳定后再做。

原因：

- 现在的核心价值在任务、Wiki、Agent API、数据闭环，不在窗口外壳。
- 过早做完整桌面端会把部署、数据库、备份、Agent token 管理都复杂化。

## 下一步执行单元

下一次执行应该交付一个可打开的 `.28` preview：

1. 本地生成当前私有提交的部署包。
2. 上传到 `.28` 的 `/home/qihuo/apps/personal-os-wiki/releases/fc3e758/`。
3. 生成服务器私有 `.env`。
4. 启动 preview compose。
5. 服务端 curl 验证 `3422` 和 `3100/3000`。
6. 给出 Windows SSH tunnel 和浏览器入口。
7. 不迁移真实数据，不删除任何现有部署。
