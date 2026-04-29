# Documentation Index

This folder contains the product, deployment, agent, and release documentation
for Personal OS + Personal Wiki.

## Start Here

- [Getting Started](./GETTING_STARTED.md)
- [快速上手](./GETTING_STARTED.zh-CN.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [部署指南](./DEPLOYMENT.zh-CN.md)
- [macOS Deployment Guide](./MACOS_DEPLOYMENT.md)
- [macOS 部署指南](./MACOS_DEPLOYMENT.zh-CN.md)
- [Releases and Packages](./RELEASES.md)
- [版本发布与安装包](./RELEASES.zh-CN.md)
- [Comparison](./COMPARISON.md)
- [对比说明](./COMPARISON.zh-CN.md)
- [Launch Playbook](./LAUNCH_PLAYBOOK.md)
- [Launch 手册](./LAUNCH_PLAYBOOK.zh-CN.md)
- [Architecture](./ARCHITECTURE.md)
- [架构说明](./ARCHITECTURE.zh-CN.md)
- [Why Not Just Long-Term Memory?](./WHY_NOT_LONG_TERM_MEMORY.md)
- [为什么不只是长期记忆？](./WHY_NOT_LONG_TERM_MEMORY.zh-CN.md)

## Agent And Automation

- [Agent Guide](./AGENT_GUIDE.md)
- [Agent 使用手册](./AGENT_GUIDE.zh-CN.md)
- [Agent Prompt](./AGENT_PROMPT.md)
- [Agent 提示词](./AGENT_PROMPT.zh-CN.md)
- [Agent Job Orchestration](./AGENT_JOB_ORCHESTRATION.md)
- [Mac Agent Adapter](./MAC_AGENT_ADAPTER.md)
- [Mac Agent Adapter 操作手册](./MAC_AGENT_ADAPTER.zh-CN.md)
- [API Overview](./API_OVERVIEW.md)

## Safety And Release

- [Data Safety](./DATA_SAFETY.md)
- [数据安全](./DATA_SAFETY.zh-CN.md)
- [Repository Strategy](./REPOSITORY_STRATEGY.md)
- [仓库拆分与开源策略](./REPOSITORY_STRATEGY.zh-CN.md)
- [Repository Permissions](./PERMISSIONS.md)
- [Security Policy](../SECURITY.md)
- [Open Source Release Process](../OPEN_SOURCE_RELEASE.md)
- [Roadmap](./ROADMAP.md)

## Component Docs

- [Personal OS README](../personal-os-app/README.md)
- [Hermes API Contract](../personal-os-app/docs/HERMES_API.md)
- [Daily Planner](../personal-os-app/docs/DAILY_PLANNER.md)
- [Proactive Reminders](../personal-os-app/docs/PROACTIVE_REMINDERS.md)
- [Personal Wiki README](../personal-wiki/README.md)
- [Personal Wiki Usage](../personal-wiki/docs/USAGE.md)

## Reading Order For Reviewers

1. Read the root [`README.md`](../README.md) or [`README.zh-CN.md`](../README.zh-CN.md).
2. Run `docker compose up -d --build` or skim the Getting Started guide.
3. Read the macOS guide if the target host is a Mac.
4. Read the comparison document if you are judging positioning.
5. Read the architecture document in your preferred language.
6. Read the Agent guide and Agent Job Orchestration if you are reviewing worker execution.
7. Read Data Safety before connecting real notes, tasks, reminders, or server data.
8. Read Open Source Release Process before publishing or making the repository public.
