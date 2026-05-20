# Documentation Index

This folder contains the product, deployment, agent, and release documentation
for Personal OS + Personal Wiki.

## Language Model

The public release is English-first with a complete Chinese path:

- English users should be able to start from `README.md` and stay in English for
  the main install, architecture, agent, API, safety, and release docs.
- Chinese users should be able to start from `README.zh-CN.md` and stay in
  Chinese for the same main path.
- Advanced/internal-direction docs may lag in one language, but user-facing
  install, agent execution, safety, and release docs should keep paired
  `*.zh-CN.md` files.

## Start Here

- [Getting Started](./GETTING_STARTED.md)
- [快速上手](./GETTING_STARTED.zh-CN.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [部署指南](./DEPLOYMENT.zh-CN.md)
- [Service Topology](./SERVICE_TOPOLOGY.md)
- [服务拓扑说明](./SERVICE_TOPOLOGY.zh-CN.md)
- [macOS Deployment Guide](./MACOS_DEPLOYMENT.md)
- [macOS 部署指南](./MACOS_DEPLOYMENT.zh-CN.md)
- [Releases and Packages](./RELEASES.md)
- [版本发布与安装包](./RELEASES.zh-CN.md)
- [Comparison](./COMPARISON.md)
- [对比说明](./COMPARISON.zh-CN.md)
- [Launch Playbook](./LAUNCH_PLAYBOOK.md)
- [Launch 手册](./LAUNCH_PLAYBOOK.zh-CN.md)
- [Maintenance Manual](./MAINTENANCE_MANUAL.md)
- [维护手册](./MAINTENANCE_MANUAL.zh-CN.md)
- [Architecture](./ARCHITECTURE.md)
- [架构说明](./ARCHITECTURE.zh-CN.md)
- [Human-Agent Collaboration Roadmap](./HUMAN_AGENT_COLLABORATION_ROADMAP.md)
- [人机协同路线图](./HUMAN_AGENT_COLLABORATION_ROADMAP.zh-CN.md)
- [Knowledge System Plan](./KNOWLEDGE_SYSTEM_PLAN.md)
- [知识系统落地方案](./KNOWLEDGE_SYSTEM_PLAN.zh-CN.md)
- [Obsidian Bridge Plan](./OBSIDIAN_BRIDGE_PLAN.md)
- [Obsidian 桥接方案](./OBSIDIAN_BRIDGE_PLAN.zh-CN.md)
- [Object Knowledge Rebuild Manual](./OBJECT_KNOWLEDGE_REBUILD_MANUAL.md)
- [对象化知识库长期大改手册](./OBJECT_KNOWLEDGE_REBUILD_MANUAL.zh-CN.md)
- [Working Manual](./WORKING_MANUAL.md)
- [工作手册](./WORKING_MANUAL.zh-CN.md)
- [Why Not Just Long-Term Memory?](./WHY_NOT_LONG_TERM_MEMORY.md)
- [为什么不只是长期记忆？](./WHY_NOT_LONG_TERM_MEMORY.zh-CN.md)

## Agent And Automation

- [Agent Guide](./AGENT_GUIDE.md)
- [Agent 使用手册](./AGENT_GUIDE.zh-CN.md)
- [Agent Prompt](./AGENT_PROMPT.md)
- [Agent 提示词](./AGENT_PROMPT.zh-CN.md)
- [Agent Job Orchestration](./AGENT_JOB_ORCHESTRATION.md)
- [Agent 作业编排](./AGENT_JOB_ORCHESTRATION.zh-CN.md)
- [Human-Agent Collaboration Roadmap](./HUMAN_AGENT_COLLABORATION_ROADMAP.md)
- [Web Capture](./WEB_CAPTURE.md)
- [网页采集](./WEB_CAPTURE.zh-CN.md)
- [Mac Agent Adapter](./MAC_AGENT_ADAPTER.md)
- [Mac Agent Adapter 操作手册](./MAC_AGENT_ADAPTER.zh-CN.md)
- [API Overview](./API_OVERVIEW.md)
- [X Likes Knowledge Pipeline](./X_LIKES_KNOWLEDGE_PIPELINE.zh-CN.md)
- [API 总览](./API_OVERVIEW.zh-CN.md)

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
3. Read Service Topology if you are checking whether OS and Wiki are one
   product, one service, or two runtime services.
4. Read the human-agent collaboration roadmap and knowledge-system plan if you
   are judging product direction.
5. Read the maintenance manual if you are taking over project work, choosing
   the next issue, or recording public-safe progress.
6. Read Obsidian Bridge Plan if you are connecting Personal Wiki to Obsidian.
7. Read Object Knowledge Rebuild Manual if you are working on the long-term
   Wiki/object/graph rebuild.
8. Read the macOS guide if the target host is a Mac.
9. Read the comparison document if you are judging positioning.
10. Read the architecture document in your preferred language.
11. Read the Agent guide and Agent Job Orchestration if you are reviewing worker execution.
12. Read Web Capture if you are reviewing passive collection from browser/manual sources.
13. Read Data Safety before connecting real notes, tasks, reminders, or server data.
14. Read Open Source Release Process before publishing or making the repository public.
