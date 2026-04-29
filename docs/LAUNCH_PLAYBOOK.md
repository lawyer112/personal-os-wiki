# Launch Playbook

This document keeps the repository focused on the conversion path:

```text
stranger sees repo -> understands pain -> runs demo -> stars/forks/issues
```

## First-Screen Standard

The README first screen should answer four things before deep architecture:

- What pain does this solve?
- What proof can I see in 60 seconds?
- How do I run it?
- Why is it different from memory, a Wiki, or a task plugin?

Current positioning:

```text
Make AI agents work from explicit tasks, evidence, and reviews instead of stale chat history.
```

Do not lead with internal component names unless the pain is already clear.

## One-Minute Demo Story

The visual proof should show this loop:

```text
messy input -> Wiki note -> task -> agent claim -> evidence -> review -> reminder
```

All screenshots and GIFs must use fake seed data only.

Good demo inputs:

- a saved GitHub link;
- a rough voice note;
- a project idea;
- a small research task;
- a fake launch checklist.

Never record real vault data, private tasks, private server inventory, tokens,
or personal reminders.

## One-Command Demo

The public README should keep this path visible:

```bash
docker compose up -d --build
```

Demo credentials:

```text
Personal OS read token: demo-read-token
Personal Wiki read token: demo-wiki-read-token
```

This path is for quick evaluation. Production deployment should still use the
Deployment Guide and real secrets.

## First Audience

Do not start with broad personal knowledge management. That category is crowded.

The first audience is narrower:

- local AI agent builders;
- Codex, Claude Code, Hermes, OpenClaw, and custom agent users;
- people running multiple projects through multiple agents;
- people who need task state, evidence, review, and reminders.

## Content Angles

English:

- I built a local-first task control plane for AI agents
- Why long-term memory is not enough for real agent work
- From Markdown notes to reviewable agent tasks
- Stop asking agents to remember; give them a work queue

Chinese:

- 我做了一个给 AI Agent 用的个人任务操作系统
- 为什么“长期记忆”不适合当任务系统
- 让 Agent 接任务、心跳、提交证据、等复核
- 别让 Agent 只会聊天，给它一个任务队列

## Launch Checklist

- README first screen has one-sentence positioning.
- README includes 60-second visual proof.
- Root demo runs with `docker compose up -d --build`.
- Issue templates exist.
- At least five `good first issue` items exist.
- Comparison doc exists.
- Release package exists.
- Main CI is green.
- GitHub Traffic is saved daily during launch week.

## Traffic Capture

GitHub Traffic is a short rolling window, so save it daily during launch week:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\save-github-traffic.ps1
```

Snapshots are written to `metrics/github-traffic/` and ignored by Git.
