# 版本发布与安装包

这个项目按“源码 + 版本化 Release 压缩包”的方式发布。它现在不是一键桌面
应用，也不是托管 SaaS。

## 版本规则

- 根目录 [`VERSION`](../VERSION) 是整个仓库的发布版本。
- 公开发布时，`personal-os-app/package.json` 的版本应与根目录版本一致。
- Personal Wiki 是同一个产品包里的 Python 服务，跟随根目录版本。
- Git tag 使用 `vX.Y.Z`，例如 `v0.1.0`。
- 面向用户的变化记录在 [`CHANGELOG.md`](../CHANGELOG.md)。

## Release 包里有什么

包含：

- Personal OS 源码、Prisma schema、测试、文档和 Docker 文件。
- Personal Wiki 源码、文档、脚本和 Docker 文件。
- 根目录文档、`.env.example` 模板、虚构 demo 数据和发布元信息。

不包含：

- `.env`、token、cookie、SSH key、agent 环境变量导出。
- 真实 Wiki vault、Personal OS 数据库 dump、任务历史、提醒事项、服务器台账、
  私人截图、日志、`node_modules`、`.next` 或运行时生成数据。

## 用户怎么安装

### 方式 A：下载 GitHub Release

下载：

```text
personal-os-wiki-v0.1.0.zip
personal-os-wiki-v0.1.0.tar.gz
SHA256SUMS.txt
```

先校验 SHA256，再解压，然后按这些文档部署：

- [快速上手](./GETTING_STARTED.zh-CN.md)
- [部署指南](./DEPLOYMENT.zh-CN.md)

### 方式 B：按版本 tag 克隆

```bash
git clone --branch v0.1.0 https://github.com/lawyer112/personal-os-wiki.git
cd personal-os-wiki
```

然后继续按快速上手或部署指南执行。

### 方式 C：跟踪 `main`

`main` 更适合开发者和审查者。普通用户应该优先使用 Release 版本。

## 维护者如何打包

本地生成发布包：

```powershell
pwsh ./scripts/package-release.ps1 -Version 0.1.0
```

如果 Windows 上没有 PowerShell 7，可以用系统自带 Windows PowerShell：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-release.ps1 -Version 0.1.0
```

产物：

```text
dist/personal-os-wiki-v0.1.0.zip
dist/personal-os-wiki-v0.1.0.tar.gz
dist/SHA256SUMS.txt
```

脚本会先创建干净 staging 目录，排除运行时和生成目录，拒绝 `.env`，并生成
SHA256 校验文件。

## GitHub Release 流程

发布检查通过后：

```bash
git tag v0.1.0
git push origin v0.1.0
```

`Release` workflow 会验证应用、打包源码压缩包，并创建 GitHub Release。

手动兜底：

```bash
pwsh ./scripts/package-release.ps1 -Version 0.1.0
gh release create v0.1.0 dist/personal-os-wiki-v0.1.0.zip dist/personal-os-wiki-v0.1.0.tar.gz dist/SHA256SUMS.txt --title v0.1.0 --generate-notes
```

## Docker 镜像

第一版公开 Release 暂不发布官方 GHCR 镜像。用户从 Release 源码本地构建镜像。
等运行时升级路径和镜像仓库策略稳定后，再补官方镜像发布。
