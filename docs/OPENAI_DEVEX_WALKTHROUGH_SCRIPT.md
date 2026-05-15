# OpenAI Developer Experience Walkthrough Script

Target length: 3-5 minutes.

## 1. Opening

Hi, I am Haowen Yin. This is a short walkthrough of Personal OS + Personal
Wiki, a local-first AI agent workbench I built to solve a problem I kept seeing
in my own AI workflows: chat history is not enough for real work.

## 2. The Problem

Most AI tools answer the current prompt well. But real developer work is
messier than that. A user has saved links, voice notes, project fragments,
unfinished ideas, server observations, and outputs from different agents. The
hard question is not only what the input means. The hard question is what
should happen next, who owns it, and what evidence proves it moved forward.

## 3. The Product Loop

The core loop is simple: messy input becomes durable Wiki memory, executable
tasks, agent claims, heartbeat updates, evidence submissions, review decisions,
and updated knowledge for the next run. This gives agents a shared work state
instead of asking them to guess from old chat history.

## 4. Capture Without Spending Too Early

Personal OS can keep the raw input first. A saved link or rough idea enters the
Inbox with its original trace intact. The user does not need to write the final
title, summary, tags, or task structure. That can happen later, when an agent or
review flow decides the item is worth processing.

## 5. Wiki As Durable Memory

Stable knowledge goes into Personal Wiki as Markdown: source links, tags,
concepts, backlinks, graph-friendly structure, and human-readable notes. This
keeps durable context outside a single chat window, while still being simple
enough for people and agents to inspect.

## 6. Tasks As Execution State

If an input contains real work, Personal OS turns it into a task with a next
action, definition of done, risk level, required output, Wiki links, and review
expectations. That is the difference between an AI response and an executable
piece of work.

## 7. Agent Protocol

Agents follow a protocol: poll, claim, load context, execute, heartbeat,
contribute, submit, and review. The agent owns the task for a lease, works
against the definition of done, and submits evidence instead of claiming success
only in a message.

## 8. Review And Trust

The system does not treat an agent message as completion by default. It asks:
what changed, where is the artifact, what evidence supports it, and should a
human or reviewer agent approve it? This reviewability is what makes long-running
agent work easier to trust.

## 9. Developer Experience Fit

For Mandarin-speaking developers, the biggest gap is often not curiosity. It is
the bridge from curiosity to reliable adoption: clear demos, realistic
workflows, localized explanations, safe defaults, and a feedback loop from real
user friction back into product insight.

## 10. Closing

That is why I built this project as a product surface, not just a private note
system. It combines API design, documentation, demos, local deployment, agent
workflow design, and safety boundaries. Thank you for watching.

