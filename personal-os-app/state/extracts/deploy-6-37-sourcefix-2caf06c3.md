deploy_start=20260623T121146Z
backup_dir=/data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260623T121146Z
remote_sha256_saved=.agent-runs/cmqq4eqa800340jmjz1go2euo/artifacts/deploy-remote-sha256-sourcefix.txt
 Image personal-os-wiki-main-personal-wiki Building 
 Image personal-os-app:demo Building 
 Image personal-os-app:demo Building 
#1 [internal] load local bake definitions
#1 reading from stdin 1.89kB done
#1 DONE 0.0s

#2 [internal] load build definition from Dockerfile
#2 transferring dockerfile: 1.81kB 0.0s done
#2 DONE 0.0s

#3 [internal] load metadata for docker.io/library/node:24-alpine
#3 DONE 0.2s

#4 [internal] load .dockerignore
#4 transferring context: 104B 0.0s done
#4 DONE 0.0s

#5 [deps 1/4] FROM docker.io/library/node:24-alpine@sha256:156b55f92e98ccd5ef49578a8cea0df4679826564bad1c9d4ef04462b9f0ded6
#5 resolve docker.io/library/node:24-alpine@sha256:156b55f92e98ccd5ef49578a8cea0df4679826564bad1c9d4ef04462b9f0ded6 0.0s done
#5 DONE 0.0s

#6 [internal] load build context
#6 transferring context: 23.69kB 0.0s done
#6 DONE 0.0s

#7 [deps 4/4] RUN --mount=type=cache,target=/root/.npm   npm ci --ignore-scripts --no-audit --no-fund   --registry=https://registry.npmjs.org   --fetch-retries=5   --fetch-retry-mintimeout=20000   --fetch-retry-maxtimeout=120000   --fetch-timeout=120000
#7 CACHED

#8 [deps 2/4] WORKDIR /app
#8 CACHED

#9 [deps 3/4] COPY package.json package-lock.json ./
#9 CACHED

#10 [builder 3/6] COPY --from=deps /app/node_modules ./node_modules
#10 CACHED

#11 [builder 4/6] COPY . .
#11 DONE 0.0s

#12 [builder 5/6] RUN npx prisma generate
#12 1.950 Loaded Prisma config from prisma.config.ts.
#12 1.950 
#12 25.48 Prisma schema loaded from prisma/schema.prisma.
#12 26.02 
#12 26.02 ✔ Generated Prisma Client (v7.7.0) to ./node_modules/@prisma/client in 344ms
#12 26.02 
#12 26.02 Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
#12 26.02 
#12 26.02 
#12 26.05 npm notice
#12 26.05 npm notice New minor version of npm available! 11.13.0 -> 11.17.0
#12 26.05 npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.17.0
#12 26.05 npm notice To update run: npm install -g npm@11.17.0
#12 26.05 npm notice
#12 DONE 26.2s

#13 [builder 6/6] RUN npm run build
#13 0.359 
#13 0.359 > personal-os-app@0.2.0 build
#13 0.359 > next build
#13 0.359 
#13 0.900 Attention: Next.js now collects completely anonymous telemetry regarding usage.
#13 0.900 This information is used to shape Next.js' roadmap and prioritize features.
#13 0.900 You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
#13 0.900 https://nextjs.org/telemetry
#13 0.901 
#13 0.920 ▲ Next.js 16.2.9 (Turbopack)
#13 0.920 
#13 0.972   Creating an optimized production build ...
#13 5.161 ✓ Compiled successfully in 3.9s
#13 5.173   Running TypeScript ...
#13 11.41   Finished TypeScript in 6.2s ...
#13 11.41   Collecting page data using 7 workers ...
#13 12.48   Generating static pages using 7 workers (0/3) ...
#13 12.70 ✓ Generating static pages using 7 workers (3/3) in 228ms
#13 12.71   Finalizing page optimization ...
#13 12.75 
#13 12.75 Route (app)
#13 12.75 ┌ ƒ /
#13 12.75 ├ ○ /_not-found
#13 12.75 ├ ƒ /activity
#13 12.75 ├ ƒ /api/activity
#13 12.75 ├ ƒ /api/agent-inbox
#13 12.75 ├ ƒ /api/agent-profiles
#13 12.75 ├ ƒ /api/agent/context
#13 12.75 ├ ƒ /api/agent/runs
#13 12.75 ├ ƒ /api/agent/runs/[id]/complete
#13 12.75 ├ ƒ /api/ideas
#13 12.75 ├ ƒ /api/ideas/[id]
#13 12.75 ├ ƒ /api/ideas/[id]/promote
#13 12.75 ├ ƒ /api/inbox/items
#13 12.75 ├ ƒ /api/intake
#13 12.75 ├ ƒ /api/notes
#13 12.75 ├ ƒ /api/notifications/telegram
#13 12.75 ├ ƒ /api/planner/snapshots
#13 12.75 ├ ƒ /api/planner/today
#13 12.75 ├ ƒ /api/projects
#13 12.75 ├ ƒ /api/projects/[id]/events
#13 12.75 ├ ƒ /api/reminders/today
#13 12.75 ├ ƒ /api/tasks
#13 12.75 ├ ƒ /api/tasks/[id]
#13 12.75 ├ ƒ /api/tasks/[id]/claim
#13 12.75 ├ ƒ /api/tasks/[id]/complete
#13 12.75 ├ ƒ /api/tasks/[id]/contributions
#13 12.75 ├ ƒ /api/tasks/[id]/heartbeat
#13 12.75 ├ ƒ /api/tasks/[id]/review
#13 12.75 ├ ƒ /api/tasks/[id]/submit
#13 12.75 ├ ƒ /api/today
#13 12.75 ├ ƒ /api/wiki/open
#13 12.75 ├ ƒ /auth/read
#13 12.75 ├ ƒ /capture
#13 12.75 ├ ƒ /ideas
#13 12.75 ├ ƒ /inbox
#13 12.75 ├ ƒ /notes
#13 12.75 ├ ƒ /notes/[id]
#13 12.75 ├ ƒ /projects
#13 12.75 ├ ƒ /projects/[id]
#13 12.75 ├ ƒ /tasks
#13 12.75 ├ ƒ /tasks/[id]
#13 12.75 └ ƒ /wiki
#13 12.75 
#13 12.75 
#13 12.75 ƒ Proxy (Middleware)
#13 12.75 
#13 12.75 ○  (Static)   prerendered as static content
#13 12.75 ƒ  (Dynamic)  server-rendered on demand
#13 12.75 
#13 DONE 13.4s

#14 [runner  4/11] COPY --from=builder /app/package-lock.json ./package-lock.json
#14 CACHED

#15 [runner  3/11] COPY --from=builder /app/package.json ./package.json
#15 CACHED

#16 [runner  5/11] COPY --from=builder /app/node_modules ./node_modules
#16 CACHED

#17 [runner  6/11] COPY --from=builder /app/prisma ./prisma
#17 CACHED

#18 [runner  7/11] COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
#18 CACHED

#19 [runner  8/11] COPY --from=builder /app/.next ./.next
#19 DONE 0.1s

#20 [runner  9/11] COPY --from=builder /app/public ./public
#20 DONE 0.0s

#21 [runner 10/11] COPY --from=builder /app/scripts ./scripts
#21 DONE 0.0s

#22 [runner 11/11] COPY --from=builder /app/docs ./docs
#22 DONE 0.0s

#23 exporting to image
#23 exporting layers
#23 exporting layers 0.7s done
#23 exporting manifest sha256:0bd9be8cce9675ec4bde3091c7c184c64505fe42c6ed50e9b9b654dc6b2c61af done
#23 exporting config sha256:d0f053bc972e32bb28a32768851b0fcecd38e8d2b85f8d5cb9eed49a6831a303 done
#23 exporting attestation manifest sha256:b99fef6274f37dcfd1dec59028d281eccc79c3b334a58db1481ba73aa39413d1 done
#23 exporting manifest list sha256:f685119e7027959057eb87dbad958c2a48e915acd68b371687a88e195be54302 done
#23 naming to docker.io/library/personal-os-app:demo done
#23 unpacking to docker.io/library/personal-os-app:demo
#23 unpacking to docker.io/library/personal-os-app:demo 0.3s done
#23 DONE 1.0s

#24 resolving provenance for metadata file
#24 DONE 0.0s
 Image personal-os-app:demo Built 
time="2026-06-23T12:12:31Z" level=warning msg="volume \"personal-os-wiki-main_personal_os_data\" already exists but was not created by Docker Compose. Use `external: true` to use an existing volume"
time="2026-06-23T12:12:31Z" level=warning msg="volume \"personal-os-wiki-main_personal_os_postgres\" already exists but was not created by Docker Compose. Use `external: true` to use an existing volume"
time="2026-06-23T12:12:31Z" level=warning msg="volume \"personal-os-wiki-main_personal_wiki_data\" already exists but was not created by Docker Compose. Use `external: true` to use an existing volume"
 Container personal-os-wiki-main-personal-os-1 Recreate 
 Container personal-os-wiki-main-personal-os-1 Recreated 
 Container personal-os-wiki-main-personal-os-1 Starting 
 Container personal-os-wiki-main-personal-os-1 Started 
deploy_done=2026-06-23T12:12:32Z

__HERMES_CWD_07d1b3c1736d__/Users/xingqiwu/Documents/New project 5/personal-os-wiki/personal-os-app__HERMES_CWD_07d1b3c1736d__
