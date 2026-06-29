# Open Source Release Process

This repository is the public software package for Personal OS + Personal Wiki.
It must never become a dump of the operator's private knowledge base.

## Release Principle

Open source these things:

- application source code
- database schema and migrations
- tests
- API manuals
- Docker files and local development examples
- empty directory structure
- fake demo data

Never open source these things:

- real `.env` files
- API tokens, cookies, SSH keys, agent env exports
- populated wiki vaults
- Personal OS database dumps
- server inventory with private IPs, ports, paths, or business mapping
- logs, screenshots, pid files, generated archives
- private task history, inbox messages, reminders, or project notes

The correct mental model is:

```text
public repo = reusable engine
private machine = real memory and real execution state
```

## Repository Boundary

Use this package as the public boundary:

```text
personal-os-wiki-public-clean/
  personal-os-app/
  personal-wiki/
  docs/
  scripts/
  README.md
  README.zh-CN.md
  VERSION
  CHANGELOG.md
  OPEN_SOURCE_RELEASE.md
```

Do not publish from the live service directories or from the parent work folder.
The parent folder contains inventories, review notes, exports, and handoff files
that are useful internally but not safe as a public repository root.

## Data Boundary

Personal Wiki must use runtime data directories outside Git:

```text
personal-wiki/data/
personal-wiki/logs/
personal-wiki/run/
```

Personal OS must use runtime storage outside Git:

```text
personal-os-app/.env
personal-os-app/data/
personal-os-app/.next/
personal-os-app/node_modules/
```

If a demo is needed, create a tiny fake vault:

```text
examples/demo-vault/
```

The demo must use invented projects, invented hosts, and fake tokens. Do not
sanitize real notes by hand and then publish them; it is too easy to miss
private details.

## Safe Config Pattern

Only commit `.env.example`.

Good:

```text
PERSONAL_OS_API_TOKEN="replace-with-a-long-random-token"
PERSONAL_OS_READ_TOKEN="replace-with-a-long-random-read-token"
WIKI_API_TOKEN="replace-with-a-long-random-write-token"
WIKI_READ_TOKEN="replace-with-a-long-random-read-token"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_WIKI_URL="http://localhost:3422"
```

Bad:

```text
PERSONAL_OS_API_TOKEN="<real token>"
WIKI_API_TOKEN="<real token>"
NEXT_PUBLIC_APP_URL="http://<private-lan-host>:3100"
NEXT_PUBLIC_WIKI_URL="http://<private-lan-host>:3422"
```

Development compose files may use simple local defaults, but production compose
must require explicit secrets through environment variables.
Production compose should bind browser-facing services to localhost by default.
If a user wants LAN or Internet access, they must add an authenticated reverse
proxy and make that exposure decision explicitly.

## Release Checklist

Run from the public package root:

```bash
git status --short
```

There should be no unexpected generated files. `node_modules`, `.next`, `data`,
`logs`, `run`, `*.zip`, and `*.log` must not appear.

Run dependency and build checks:

```bash
cd personal-os-app
npm ci
DATABASE_URL="postgresql://personal_os:replace-with-a-long-random-database-password@localhost:54329/personal_os?schema=public" npm run prisma:generate
DATABASE_URL="postgresql://personal_os:replace-with-a-long-random-database-password@localhost:54329/personal_os?schema=public" npm test
DATABASE_URL="postgresql://personal_os:replace-with-a-long-random-database-password@localhost:54329/personal_os?schema=public" npx tsc --noEmit
DATABASE_URL="postgresql://personal_os:replace-with-a-long-random-database-password@localhost:54329/personal_os?schema=public" PERSONAL_OS_API_TOKEN="dev-test-token-0000" PERSONAL_OS_READ_TOKEN="dev-read-token-0000" WIKI_READ_TOKEN="dev-wiki-read-token-0000" npm run build
npm audit --omit=dev --audit-level=moderate

cd ../personal-wiki
python -m py_compile api/server.py
```

Check release metadata:

```bash
cat VERSION
rg -n "## 0\\.1\\.0|versioned release|Release" CHANGELOG.md docs/RELEASES.md docs/RELEASES.zh-CN.md README.md README.zh-CN.md
```

Run Docker image checks from the package root when Docker is available:

```bash
DOCKER_BUILDKIT=1 docker build --build-arg NPM_CONFIG_REGISTRY=https://registry.npmjs.org -t personal-os-app:test personal-os-app
DOCKER_BUILDKIT=1 docker build -f personal-wiki/api/Dockerfile -t personal-wiki:test personal-wiki
```

Clean generated artifacts after verification:

```bash
rm -rf personal-os-app/node_modules personal-os-app/.next
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force personal-os-app\node_modules, personal-os-app\.next
```

Create a local release package:

```powershell
pwsh ./scripts/package-release.ps1 -Version 0.1.2
```

On Windows PowerShell without `pwsh`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-release.ps1 -Version 0.1.2
```

Expected output:

```text
dist/personal-os-wiki-v0.1.2.zip
dist/personal-os-wiki-v0.1.2.tar.gz
dist/SHA256SUMS.txt
```

Do not commit `dist/`. It is ignored by Git and should be uploaded only as a
GitHub Release asset.

Run a final text scan:

```bash
rg -n --hidden -S "192\\.168\\.|10\\.|172\\.(1[6-9]|2[0-9]|3[0-1])\\.|your-private-domain|BEGIN OPENSSH|Bearer [A-Za-z0-9_\\-\\.]{16,}|sk-[A-Za-z0-9]{20,}|password\\s*[:=]" .
```

Expected findings should be only:

- `.env.example` placeholders
- documentation examples that say `replace-with-*`
- localhost examples
- `personal-wiki/scripts/proxy-env.sh` default `NO_PROXY` private CIDR ranges
  that are generic proxy bypass templates, not a private deployment map
- code that reads environment variables

Anything else must be removed, rewritten as a placeholder, or moved to a
private repository.

## Suggested GitHub Shape

Repository name:

```text
personal-os-wiki
```

Recommended public description:

```text
Agent-friendly Personal OS and Markdown Wiki: inbox, tasks, projects, agent task claiming, and knowledge graph backend.
```

Initial README should emphasize:

- this is a local-first personal automation stack
- Personal OS stores work state
- Personal Wiki stores durable knowledge
- agents use APIs instead of scraping the whole vault
- users must provide their own model/API integrations
- no private data is included

Documentation that must be present before public release:

- `README.md`: English project overview and quickstart
- `README.zh-CN.md`: Chinese project overview and product explanation
- `docs/ARCHITECTURE.md` and `docs/ARCHITECTURE.zh-CN.md`: component boundary
- `docs/AGENT_GUIDE.md` and `docs/AGENT_GUIDE.zh-CN.md`: agent operating manual
- `docs/REPOSITORY_STRATEGY.md` and `docs/REPOSITORY_STRATEGY.zh-CN.md`: monorepo/split-repo strategy

## Branch and Release Flow

Use three lanes:

```text
private/live
  real deployment, real data, real env

public/main
  clean open-source code

public/release-candidate
  temporary branch for final scans and GitHub publishing
```

Release flow:

1. Sync only code changes from private/live into the public package.
2. Regenerate migrations and docs.
3. Run tests and build.
4. Remove generated artifacts.
5. Run secret/private-data scan.
6. Commit to `public/release-candidate`.
7. Review Git diff manually.
8. Merge to `public/main`.
9. Push to GitHub.
10. Update `VERSION` and `CHANGELOG.md`.
11. Run `pwsh ./scripts/package-release.ps1 -Version <version>`.
12. Tag a release only after a clean clone can run the quickstart.
13. Push `v<version>` to GitHub so the Release workflow publishes archives.

Versioned release commands:

```bash
git tag v0.1.2
git push origin v0.1.2
```

Manual fallback if GitHub Actions is unavailable:

```bash
pwsh ./scripts/package-release.ps1 -Version 0.1.2
gh release create v0.1.2 dist/personal-os-wiki-v0.1.2.zip dist/personal-os-wiki-v0.1.2.tar.gz dist/SHA256SUMS.txt --title v0.1.2 --generate-notes
```

To create a clean single-commit repository from this reviewed package on
Windows:

```powershell
pwsh ./scripts/prepare-public-repo.ps1 -OutputPath ../personal-os-wiki-public-clean
```

Then add a new public GitHub remote from inside the generated directory and push
that single initial commit.

## Local Safety Rules

Do not point the public repo at the live vault by default.

Do not include scripts that read live `.env` files and open authenticated URLs.

Do not publish server ledgers, host notes, task histories, or business mappings.
If examples are needed, write fake examples from scratch.

Do not publish a token handoff script. Use browser cookie handoff or environment
variables at runtime.

Do not publish a database dump, even if it seems harmless. Inbox/task/project
data can contain business strategy, private links, and internal host names.

## Minimum Public MVP

The first public version should include:

- Personal Wiki API and UI
- Personal OS app
- `/api/intake`
- `/api/agent/context`
- `/api/agent-inbox`
- task claim/heartbeat/contribution/submit/review APIs
- `.env.example`
- Docker quickstart
- one fake demo note
- one fake demo task

The first public version should not include:

- real server ledger
- real personal wiki vault
- real Hermes profile
- real reminder lists
- real Telegram/Feishu bot config
- real task history

## Definition of Done

A release is safe only when all are true:

- A fresh clone can run the app using only `.env.example` values replaced by new local secrets.
- Secret scan has no unexplained private hits.
- Dependency audit has no unresolved moderate-or-higher findings, or every
  remaining finding has a documented non-exposure reason.
- Docker images build successfully in CI or a documented release machine.
- `git status --short` shows only intended source changes.
- README explains that the repo ships no private data.
- Runtime data paths are ignored by Git.
- Production config requires explicit secrets.
- Public release is created from a clean/squashed history, not a branch that once
  contained retired token-in-URL experiments or private handoff scripts.
- The live private deployment can keep using its own data without being moved into the public repo.
