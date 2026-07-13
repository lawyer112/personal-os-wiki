# Skill / Repo Evaluation Template v0

> Template for evaluating whether a GitHub repo, skill, or external tool should be absorbed into the Personal OS / Wiki system.
> Task ID: `cmqq2o6he000u0jmjinvl77a4`
> Created by: hermes:worker
> Source type: agent-output

## When to Use

Before any GitHub repo, npm package, MCP server, or external skill is added to the knowledge base or execution queue, run it through this template.

## Evaluation Fields

### 1. 候选 (Candidate)
- **Repo / Package**: `owner/repo` or `npm-name`
- **URL**: Direct link
- **Stars / Traction**: Social proof or usage evidence
- **Last Push**: Recency signal
- **License**: Compatibility check

### 2. 弥补缺口 (Gap Filled)
- What current capability does this fill?
- Which existing system component is weak or missing without it?
- Map to current Personal OS / Wiki / Agent stack gap.

### 3. 接入位置 (Integration Point)
- Where does it plug in? (e.g., `/api/agent/context`, `github-radar-intake.mjs`, `archive-agent-run-context-pack.mjs`, Obsidian vault, MCP server)
- What interface does it expose? (API, CLI, library, file format)

### 4. 执行人 (Owner)
- `agent` — Hermes / Codex / Claude / Kimi can execute autonomously
- `classic` — Requires human judgment, account access, or business direction
- `mixed` — Agent does scaffolding, Classic does final authorization

### 5. 产物 (Deliverable)
- Concrete output: script, config, schema, test, Wiki note, Task
- File paths or artifact names

### 6. 验收标准 (Definition of Done)
- Must be testable or verifiable in 60-120 minutes
- Includes at least: build pass, test pass, or production regression check
- No vague words like "整理" or "优化" without object + result + criteria

### 7. 风险 (Risk)
- `low` — Local-only, no secrets, no production side effects
- `medium` — Touches production API, requires backup/rollback plan
- `high` — Destructive, irreversible, or requires Classic authorization
- Specific blockers: token exposure, SSH dependency, Docker availability, external API rate limits

### 8. 不吸收原因 (Reject Reason)
- If rejected, write exactly why: duplicate, overlap, immature, wrong license, no gap, or not actionable within current runtime.

## Scoring Quick Reference

| Dimension | Weight | How to Score |
|---|---|---|
| Gap relevance | 30% | Does it solve a current P0/P1 blocker? |
| Integration friction | 25% | How many files/interfaces need to change? |
| Agent executability | 25% | Can an Agent run it without Classic intervention? |
| Maintenance burden | 15% | Stars, community, docs, test coverage |
| License / Security | 5% | MIT/Apache preferred; no closed-source blobs |

## Example Filled Template

See companion report: `skill-evaluation-report-v0.md`

---

## Usage Checklist

- [ ] Candidate identified with URL and last push date
- [ ] Gap mapped to current stack (not just "nice to have")
- [ ] Integration point specified with file path or API endpoint
- [ ] Owner labeled (agent / classic / mixed)
- [ ] Deliverable is concrete and under 120 minutes
- [ ] Definition of Done includes a verifiable test or regression check
- [ ] Risk level assigned with specific blocker list
- [ ] Either absorbed with task ID, or rejected with explicit reason