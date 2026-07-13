# Skill Evaluation Report v0 — GitHub Radar 2026-06-23 Candidates

> Task ID: `cmqq2o6he000u0jmjinvl77a4`
> Created by: hermes:worker
> Source type: agent-output
> Generated from: `.agent-runs/cmqq29yi9000c0jmjcejamrel/github-radar/repos.json`

## Method

Applied the Skill Evaluation Template v0 to all 8 repos discovered by the 2026-06-23 GitHub radar run for Personal OS / Wiki knowledge base upgrade.

---

## Candidate 1: swarmclawai/swarmvault

| Field | Value |
|---|---|
| **Repo** | swarmclawai/swarmvault |
| **URL** | https://github.com/swarmclawai/swarmvault |
| **Stars** | 580 |
| **Last Push** | 2026-06-12 |
| **License** | MIT (inferred from npm badge) |
| **Gap Filled** | Source registry + context pack + memory tiering. Personal OS currently lacks durable agent-run ledger and hot/warm/cold context routing. |
| **Integration Point** | `scripts/archive-agent-run-context-pack.mjs` (write to Wiki note); `/api/agent/context` (return tiers.hot/warm/cold) |
| **Owner** | `agent` — Hermes can scaffold archive script and context tiering; no Classic auth needed |
| **Deliverable** | `archive-agent-run-context-pack.mjs` + regression tests for `/api/agent/context` tiers |
| **Definition of Done** | A real `.agent-runs/<task-id>/` is archived to Wiki with task_id, gate, diff, tests, deployment, risks; `/api/agent/context` returns tiers; no token leakage |
| **Risk** | `low` — Local script, writes to Wiki via existing API; rollback is delete Wiki note |
| **Status** | **Absorbed** — Task `cmqqfl6rk00090jn58kastmq9` already implements context pack archiving; tiering upgrade pending |

---

## Candidate 2: ruvnet/agent-harness-generator

| Field | Value |
|---|---|
| **Repo** | ruvnet/agent-harness-generator |
| **URL** | https://github.com/ruvnet/agent-harness-generator |
| **Stars** | 292 |
| **Last Push** | 2026-06-23 (today) |
| **License** | MIT |
| **Gap Filled** | Meta-harness scaffolding with MCP server, memory, learning loop. Personal OS has ad-hoc harnesses (Hermes, Codex, Claude) but no unified scaffolding. |
| **Integration Point** | Not directly. Could inspire a unified `hermes-coding-lane` wrapper template, but too heavy for current stack. |
| **Owner** | `mixed` — Agent can review code patterns; Classic decides if we want a single harness vs. separate lanes |
| **Deliverable** | Reference notes in Wiki: `references/agent-harness-generator-patterns.md` |
| **Definition of Done** | Wiki note lists 3 patterns we can adopt without full scaffolding; no code changes |
| **Risk** | `low` — Read-only reference; no execution |
| **Status** | **Reference only** — No task created; revisit if we consolidate lanes |

---

## Candidate 3: itechmeat/open-second-brain

| Field | Value |
|---|---|
| **Repo** | itechmeat/open-second-brain |
| **URL** | https://github.com/itechmeat/open-second-brain |
| **Stars** | 92 |
| **Last Push** | 2026-06-22 |
| **License** | Unknown (check before absorbing) |
| **Gap Filled** | Obsidian-native memory layer with nightly dream passes. Personal OS already has Personal Wiki + Obsidian vault; this could enhance the bridge. |
| **Integration Point** | Obsidian vault sync; MCP server adapter |
| **Owner** | `mixed` — Agent can evaluate adapters; Classic needs to approve Obsidian plugin installation |
| **Deliverable** | Wiki reference note + Obsidian plugin compatibility matrix |
| **Definition of Done** | Wiki note documents whether the MCP server works with our current Hermes setup; no plugin installed without Classic approval |
| **Risk** | `medium` — Obsidian plugin installation affects local vault; nightly dream passes could overwrite notes |
| **Status** | **Pending Classic decision** — Create a `needsHumanDecision` task if Classic wants to trial it |

---

## Candidate 4: Zhonghao1995/agentic-swmm-workflow

| Field | Value |
|---|---|
| **Repo** | Zhonghao1995/agentic-swmm-workflow |
| **URL** | https://github.com/Zhonghao1995/agentic-swmm-workflow |
| **Stars** | 13 |
| **Last Push** | 2026-06-23 |
| **License** | Unknown |
| **Gap Filled** | None for current stack. Domain-specific (stormwater modeling) with no overlap to Personal OS / Wiki / Agent memory. |
| **Integration Point** | None applicable |
| **Owner** | `n/a` |
| **Deliverable** | None |
| **Definition of Done** | None |
| **Risk** | `low` — No action needed |
| **Status** | **Rejected** — Reason: No gap; domain-specific; low stars; no integration point |

---

## Candidate 5: Walliiee/agent-harness

| Field | Value |
|---|---|
| **Repo** | Walliiee/agent-harness |
| **URL** | https://github.com/Walliiee/agent-harness |
| **Stars** | 0 |
| **Last Push** | 2026-06-23 |
| **License** | MIT |
| **Gap Filled** | Layered memory + drift-fixing loop + evals. Overlaps with swarmvault and open-second-brain. |
| **Integration Point** | Overlaps with existing `archive-agent-run-context-pack.mjs` and context tiering work. |
| **Owner** | `agent` |
| **Deliverable** | None — absorb patterns into existing tasks rather than new code |
| **Definition of Done** | None standalone |
| **Risk** | `low` — No new code |
| **Status** | **Rejected** — Reason: Overlaps with swarmvault and EverOS; 0 stars; too early |

---

## Candidate 6: willynikes2/knowledge-base-server

| Field | Value |
|---|---|
| **Repo** | willynikes2/knowledge-base-server |
| **URL** | https://github.com/willynikes2/knowledge-base-server |
| **Stars** | 171 |
| **Last Push** | 2026-04-04 (stale) |
| **License** | Unknown |
| **Gap Filled** | SQLite FTS5 + MCP server + Obsidian sync + learning pipeline. Similar to our Personal Wiki but with built-in FTS5 and MCP. |
| **Integration Point** | Could replace or enhance Personal Wiki search layer; requires SQLite schema migration |
| **Owner** | `mixed` — Agent can prototype; Classic decides if we replace current Wiki backend |
| **Deliverable** | Wiki reference note + compatibility assessment |
| **Definition of Done** | Document whether our Next.js + file-based Wiki can adopt FTS5 search or MCP sync without breaking existing notes |
| **Risk** | `medium` — Backend change; stale repo (last push 2.5 months ago) |
| **Status** | **Reference only** — Stale repo; do not integrate unless revived |

---

## Candidate 7: EverMind-AI/EverOS

| Field | Value |
|---|---|
| **Repo** | EverMind-AI/EverOS |
| **URL** | https://github.com/EverMind-AI/EverOS |
| **Stars** | 8500 |
| **Last Push** | 2026-06-23 |
| **License** | Unknown |
| **Gap Filled** | Self-evolving portable memory layer across agents. Highest social proof. Fills the gap of agent-agnostic memory. |
| **Integration Point** | MCP server or API bridge to Personal OS; could be a Wiki backend replacement |
| **Owner** | `mixed` — Agent can evaluate API; Classic decides if we add external dependency |
| **Deliverable** | Wiki reference note + API compatibility matrix |
| **Definition of Done** | Document EverOS API endpoints and whether they map to our `/api/intake` and `/api/wiki/notes` schemas |
| **Risk** | `medium` — 8500 stars but unknown license; external dependency adds operational risk |
| **Status** | **Reference only** — Evaluate again after license clarified and v1 API stable |

---

## Candidate 8: mnemon-dev/mnemon

| Field | Value |
|---|---|
| **Repo** | mnemon-dev/mnemon |
| **URL** | https://github.com/mnemon-dev/mnemon |
| **Stars** | 360 |
| **Last Push** | 2026-06-22 |
| **License** | Unknown (Go project) |
| **Gap Filled** | Graph-based recall + cross-session knowledge + single binary. Similar to our graph-recall goals. |
| **Integration Point** | Binary could be sidecar to Personal OS for graph queries; requires Go build |
| **Owner** | `agent` — Agent can build and test binary; no Classic auth needed for evaluation |
| **Deliverable** | Wiki reference note + binary smoke test result |
| **Definition of Done** | Build binary from source, run against a sample task graph, document output schema |
| **Risk** | `low` — Sidecar evaluation; no production change |
| **Status** | **Absorb for evaluation** — Create a low-risk `agent_allowed` task to build and smoke test |

---

## Summary Table

| # | Repo | Score | Status | Owner | Risk | Action |
|---|---|---|---|---|---|
| 1 | swarmclawai/swarmvault | 65.58 | Absorbed | agent | low | Already implemented in `cmqqfl6rk00090jn58kastmq9` |
| 2 | ruvnet/agent-harness-generator | 65.29 | Reference only | mixed | low | Wiki note only; no task |
| 3 | itechmeat/open-second-brain | 65.09 | Pending Classic | mixed | medium | Needs Classic approval for Obsidian plugin |
| 4 | Zhonghao1995/agentic-swmm-workflow | 65.01 | Rejected | n/a | low | No gap; domain-specific |
| 5 | Walliiee/agent-harness | 65.00 | Rejected | n/a | low | Overlap; 0 stars |
| 6 | willynikes2/knowledge-base-server | 61.17 | Reference only | mixed | medium | Stale repo |
| 7 | EverMind-AI/EverOS | 60.00 | Reference only | mixed | medium | Needs license check |
| 8 | mnemon-dev/mnemon | 55.36 | Absorb for eval | agent | low | Create smoke-test task |

---

## Next Actions

1. **Agent**: Create `agent_allowed` task for mnemon binary smoke test (estimate 60 min, low risk).
2. **Classic**: Decide whether to trial `open-second-brain` Obsidian plugin integration.
3. **Agent**: Monitor EverOS for license clarification and v1 API stability; revisit in next radar cycle.
4. **Agent**: Do not create tasks for rejected repos (agentic-swmm, agent-harness).