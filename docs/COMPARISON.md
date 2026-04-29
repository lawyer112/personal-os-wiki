# Personal OS vs Agent Memory vs Obsidian Task Plugins

The short version:

```text
Agent memory remembers preferences.
Obsidian plugins organize notes.
Personal OS + Personal Wiki turns knowledge into reviewable agent work.
```

## The Problem

Real agent work breaks when the source of truth is a chat transcript.

An agent may remember that a topic exists, but still not know:

- what task is currently open;
- who claimed it;
- when the claim expires;
- what evidence was submitted;
- whether a reviewer approved it;
- what reminder should be delivered today;
- which Wiki note backs the decision.

That is why this project is not trying to be a better note app only. It is a
task control plane for agents, with a Markdown Wiki as durable context.

## Comparison

| Capability | Agent long-term memory | Obsidian task plugins | Personal OS + Personal Wiki |
| --- | --- | --- | --- |
| Remembers user preferences | Strong | Weak | Uses agents' own memory for this |
| Stores durable notes | Weak to medium | Strong | Strong, Markdown-based |
| Creates backlinks and knowledge graph | Usually no | Strong | Yes, via Wiki notes and graph data |
| Tracks explicit task ownership | Usually no | Limited | Yes, with task claims |
| Handles agent heartbeats and leases | No | No | Yes |
| Requires evidence before review | No | No | Yes |
| Separates read/write tokens for agents | Usually no | Not applicable | Yes |
| Produces reminder payloads | Usually no | Limited | Yes |
| Works as a shared API for multiple agents | Usually no | No | Yes |
| Keeps private runtime data out of Git | Depends | Depends | Designed into the repo boundary |

## When To Use Each

Use agent long-term memory for stable facts:

- user preferences;
- naming conventions;
- recurring operating rules;
- long-lived constraints.

Use Obsidian or note plugins for human knowledge browsing:

- reading notes;
- manual linking;
- writing long-form research;
- personal journaling.

Use Personal OS + Personal Wiki when you need execution state:

- tasks that agents can claim;
- reviewable submissions;
- evidence links;
- daily planning;
- reminder delivery;
- project status that should survive across agents and sessions.

## Why This Is Not Just Another Second Brain

A second brain answers:

```text
What did I know?
```

This project answers:

```text
What should move next, who owns it, and what evidence proves it moved?
```

That is the narrow wedge. The project should keep optimizing for agent
execution loops, not generic personal knowledge management.
