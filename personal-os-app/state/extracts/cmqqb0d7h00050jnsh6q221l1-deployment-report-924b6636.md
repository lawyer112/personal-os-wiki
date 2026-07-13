# cmqqb0d7h00050jnsh6q221l1 deployment report

## Result

Deployed to 6.37 by Hermes without requiring Classic review.

## GitHub

- Repo: https://github.com/lawyer112/personal-os-wiki
- Commits:
  - `10b673e` Split Personal Wiki read and write clients
  - `a1e8445` Allow wiki ingest calls without explicit metadata
- CI: `28014816221` passed.

## Local verification

- `npm test`: 18 files / 67 tests passed
- `npm audit --omit=dev --audit-level=moderate`: 0 vulnerabilities
- `npx tsc --noEmit`: passed
- `npm run lint`: passed
- `DATABASE_URL=<dummy> npm run build`: passed

## 6.37 deployment

Runtime files copied:
- `personal-os-app/src/app/api/intake/route.ts`
- `personal-os-app/src/app/wiki/page.tsx`
- `personal-os-app/src/lib/wiki-client.ts`
- `personal-os-app/src/lib/wiki-ingest.ts`

Backups:
- `/data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260623-165850`
- `/data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260623-170424`

Commands:
- `docker compose -p personal-os-wiki-main build personal-os`
- `docker compose -p personal-os-wiki-main up -d --no-deps personal-os`

Health:
- `root_http=307`
- container: `personal-os-wiki-main-personal-os-1` up

## Production regression

Evidence: `artifacts/post-deploy-production-regression.json`

- Personal OS context: 200
- Personal Wiki health: 200
- Personal OS `/wiki`: 200
- `/api/intake` fallback: HTTP 201, `ok=true`
- regression inbox: `cmqqf5x5s00000jo40mvnw42w`
- regression agentRun: `cmqqf5xb500020jo44aayvss4`
- expected fallback: `wiki_write_status.status=failed` but OS write survived

## Writeback

Evidence: `artifacts/writeback-deployment-result.json`

- Task review: 200
- Task status: done
- writeback inbox: `cmqqf7mvi00070jo4nlgqwxsr`
- writeback agentRun: `cmqqf7n3u00090jo4n3spwxpo`
- Wiki write status: ok

## Executor correction

Cron job `b73a310b1a0a` updated: gate=pass internal Personal OS/Wiki deployments should continue to 6.37 with backup and regression; do not ask Classic to review diff.patch or arrange a deploy window unless the operation is destructive, paid, public, credential-related, or a business-direction decision.