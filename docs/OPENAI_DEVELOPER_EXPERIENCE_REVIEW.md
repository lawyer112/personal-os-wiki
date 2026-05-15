# Developer Experience Review Kit

This page is a short review path for people evaluating Personal OS + Personal
Wiki as evidence of developer experience, AI workflow design, and
Mandarin-speaking developer empathy.

## 60-Second Review Path

1. Watch the walkthrough:
   [`docs/assets/demo/openai-devex-walkthrough.mp4`](./assets/demo/openai-devex-walkthrough.mp4)
2. Skim the product loop in the root [`README.md`](../README.md).
3. Read the agent protocol in [`AGENT_GUIDE.md`](./AGENT_GUIDE.md).
4. Read the API surface in [`API_OVERVIEW.md`](./API_OVERVIEW.md).
5. Check the safety boundary in [`DATA_SAFETY.md`](./DATA_SAFETY.md).

## Why This Project Exists

AI power users and developers do not only need better answers inside a chat
window. Once work becomes long-running, they need explicit state:

- what the task is;
- who or which agent owns it;
- what context the agent should load;
- what evidence proves progress;
- who reviews the result;
- what durable knowledge should be updated for the next run.

Personal OS + Personal Wiki explores that layer. It turns messy inputs, saved
links, voice notes, project fragments, and agent outputs into a local-first
work loop:

```text
messy input -> durable wiki memory -> executable task
  -> agent claim -> heartbeat -> evidence submission
  -> review -> knowledge updated for the next run
```

## Developer Experience Evidence

This repository is meant to be understandable by another developer, not only by
the original author.

| OpenAI developer-experience need | Evidence in this repository |
| --- | --- |
| High-quality demos | README demo media, one-command fake-data demo, and the OpenAI DevEx walkthrough video. |
| Tutorials and guides | Getting Started, Deployment, macOS Deployment, Agent Guide, API Overview, and bilingual README files. |
| Code samples | Curl-based task claiming flow, agent prompt, Docker Compose setup, and seeded fake-data workflow. |
| Developer empathy | The project targets real AI workflow friction: context drift, unfinished work, agent trust, reviewability, and cost-aware capture. |
| Feedback loop thinking | The design makes user friction observable through Inbox items, tasks, reviews, artifacts, and knowledge updates. |
| Safety and trust | Local-first defaults, fake public data, token separation, review gates, and a documented data-safety boundary. |

## Mandarin-Speaking Developer Fit

Mandarin-speaking AI users are often curious and fast-moving, but adoption
breaks when examples are too abstract or copied directly from English-only
workflows. This project is built around a practical bridge:

- bilingual docs and terminology;
- concrete local deployment paths;
- realistic workflow demos instead of abstract product claims;
- safety notes that translate model capability into trusted usage;
- examples that connect agent behavior, API design, and product outcomes.

## What To Look At In An Interview

Useful interview demo path:

1. Open the README and explain the product loop.
2. Show Personal OS as the work-state surface: Inbox, Tasks, Today, Reviews.
3. Show Personal Wiki as durable Markdown memory.
4. Walk through an agent protocol: poll, claim, load context, heartbeat,
   submit evidence, request review.
5. Discuss what should stay local, what can be public, and how to avoid turning
   a private life or private infrastructure into an open-source dump.
6. Discuss how these patterns could become better docs, examples, videos, and
   feedback loops for Mandarin-speaking developers using OpenAI APIs and agents.

## Boundary

The public repository contains source code, documentation, generated fake demo
media, and safe sample data. It should not contain private Wiki vaults, real
task history, customer data, hostnames, tokens, logs, or production server maps.

