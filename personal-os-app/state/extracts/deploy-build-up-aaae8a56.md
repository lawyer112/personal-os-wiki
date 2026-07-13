 Image personal-os-app:demo Building 
 Image personal-os-app:demo Building 
 Image personal-os-wiki-main-personal-wiki Building 
#1 [internal] load local bake definitions
#1 reading from stdin 1.89kB done
#1 DONE 0.0s

#2 [internal] load build definition from Dockerfile
#2 transferring dockerfile: 1.81kB done
#2 DONE 0.0s

#3 [internal] load metadata for docker.io/library/node:24-alpine
#3 DONE 0.5s

#4 [internal] load .dockerignore
#4 transferring context: 104B done
#4 DONE 0.0s

#5 [deps 1/4] FROM docker.io/library/node:24-alpine@sha256:156b55f92e98ccd5ef49578a8cea0df4679826564bad1c9d4ef04462b9f0ded6
#5 resolve docker.io/library/node:24-alpine@sha256:156b55f92e98ccd5ef49578a8cea0df4679826564bad1c9d4ef04462b9f0ded6 0.0s done
#5 DONE 0.0s

#6 [internal] load build context
#6 transferring context: 37.24kB 0.0s done
#6 DONE 0.0s

#7 [deps 2/4] WORKDIR /app
#7 CACHED

#8 [deps 3/4] COPY package.json package-lock.json ./
#8 CACHED

#9 [deps 4/4] RUN --mount=type=cache,target=/root/.npm   npm ci --ignore-scripts --no-audit --no-fund   --registry=https://registry.npmjs.org   --fetch-retries=5   --fetch-retry-mintimeout=20000   --fetch-retry-maxtimeout=120000   --fetch-timeout=120000
#9 CACHED

#10 [builder 3/6] COPY --from=deps /app/node_modules ./node_modules
#10 CACHED

#11 [builder 4/6] COPY . .
#11 DONE 0.0s

#12 [builder 5/6] RUN npx prisma generate
#12 1.827 Loaded Prisma config from prisma.config.ts.
#12 1.827 
#12 6.727 Prisma schema loaded from prisma/schema.prisma.
#12 7.280 
#12 7.280 ✔ Generated Prisma Client (v7.7.0) to ./node_modules/@prisma/client in 351ms
#12 7.280 
#12 7.280 Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
#12 7.280 
#12 7.280 
#12 7.329 npm notice
#12 7.329 npm notice New minor version of npm available! 11.13.0 -> 11.17.0
#12 7.329 npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.17.0
#12 7.329 npm notice To update run: npm install -g npm@11.17.0
#12 7.329 npm notice
#12 DONE 7.4s

#13 [builder 6/6] RUN npm run build
#13 0.908 
#13 0.908 > personal-os-app@0.2.0 build
#13 0.908 > next build
#13 0.908 
#13 1.487 Attention: Next.js now collects completely anonymous telemetry regarding usage.
#13 1.488 This information is used to shape Next.js' roadmap and prioritize features.
#13 1.488 You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
#13 1.488 https://nextjs.org/telemetry
#13 1.488 
#13 1.508 ▲ Next.js 16.2.9 (Turbopack)
#13 1.508 
#13 1.557   Creating an optimized production build ...
#13 5.254 ✓ Compiled successfully in 3.4s
#13 5.263   Running TypeScript ...
#13 11.53   Finished TypeScript in 6.3s ...
#13 11.53   Collecting page data using 7 workers ...
#13 12.44   Generating static pages using 7 workers (0/3) ...
#13 12.61 ✓ Generating static pages using 7 workers (3/3) in 172ms
#13 12.62   Finalizing page optimization ...
#13 12.63 
#13 12.64 Route (app)
#13 12.64 ┌ ƒ /
#13 12.64 ├ ○ /_not-found
#13 12.64 ├ ƒ /activity
#13 12.64 ├ ƒ /api/activity
#13 12.64 ├ ƒ /api/agent-inbox
#13 12.64 ├ ƒ /api/agent-profiles
#13 12.64 ├ ƒ /api/agent/context
#13 12.64 ├ ƒ /api/agent/runs
#13 12.64 ├ ƒ /api/agent/runs/[id]/complete
#13 12.64 ├ ƒ /api/ideas
#13 12.64 ├ ƒ /api/ideas/[id]
#13 12.64 ├ ƒ /api/ideas/[id]/promote
#13 12.64 ├ ƒ /api/inbox/items
#13 12.64 ├ ƒ /api/intake
#13 12.64 ├ ƒ /api/notes
#13 12.64 ├ ƒ /api/notifications/telegram
#13 12.64 ├ ƒ /api/planner/snapshots
#13 12.64 ├ ƒ /api/planner/today
#13 12.64 ├ ƒ /api/projects
#13 12.64 ├ ƒ /api/projects/[id]/events
#13 12.64 ├ ƒ /api/reminders/today
#13 12.64 ├ ƒ /api/tasks
#13 12.64 ├ ƒ /api/tasks/[id]
#13 12.64 ├ ƒ /api/tasks/[id]/claim
#13 12.64 ├ ƒ /api/tasks/[id]/complete
#13 12.64 ├ ƒ /api/tasks/[id]/contributions
#13 12.64 ├ ƒ /api/tasks/[id]/heartbeat
#13 12.64 ├ ƒ /api/tasks/[id]/review
#13 12.64 ├ ƒ /api/tasks/[id]/submit
#13 12.64 ├ ƒ /api/today
#13 12.64 ├ ƒ /api/wiki/open
#13 12.64 ├ ƒ /auth/read
#13 12.64 ├ ƒ /capture
#13 12.64 ├ ƒ /ideas
#13 12.64 ├ ƒ /inbox
#13 12.64 ├ ƒ /notes
#13 12.64 ├ ƒ /notes/[id]
#13 12.64 ├ ƒ /projects
#13 12.64 ├ ƒ /projects/[id]
#13 12.64 ├ ƒ /tasks
#13 12.64 ├ ƒ /tasks/[id]
#13 12.64 └ ƒ /wiki
#13 12.64 
#13 12.64 
#13 12.64 ƒ Proxy (Middleware)
#13 12.64 
#13 12.64 ○  (Static)   prerendered as static content
#13 12.64 ƒ  (Dynamic)  server-rendered on demand
#13 12.64 
#13 DONE 13.2s

#14 [runner  6/11] COPY --from=builder /app/prisma ./prisma
#14 CACHED

#15 [runner  3/11] COPY --from=builder /app/package.json ./package.json
#15 CACHED

#16 [runner  4/11] COPY --from=builder /app/package-lock.json ./package-lock.json
#16 CACHED

#17 [runner  5/11] COPY --from=builder /app/node_modules ./node_modules
#17 CACHED

#18 [runner  7/11] COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
#18 CACHED

#19 [runner  8/11] COPY --from=builder /app/.next ./.next
#19 DONE 0.2s

#20 [runner  9/11] COPY --from=builder /app/public ./public
#20 DONE 0.0s

#21 [runner 10/11] COPY --from=builder /app/scripts ./scripts
#21 DONE 0.4s

#22 [runner 11/11] COPY --from=builder /app/docs ./docs
#22 DONE 0.0s

#23 exporting to image
#23 exporting layers
#23 exporting layers 0.7s done
#23 exporting manifest sha256:7e6601da24ca4195bcad22502446a5d49fb8873de604070c3896391f679af00c done
#23 exporting config sha256:4eb40c3d53e09accc3678b87c2c81201dd54070bafbff5ccbc30ced08c6c892b done
#23 exporting attestation manifest sha256:b26c69adb14526174e844eb7e2cef8545802906a14c5c0bb780d515d69e75296 done
#23 exporting manifest list sha256:c117f76efc46ec037d2693994cb9785515c9c3f026abc17fd1a9a9347c9772c5 done
#23 naming to docker.io/library/personal-os-app:demo done
#23 unpacking to docker.io/library/personal-os-app:demo
#23 unpacking to docker.io/library/personal-os-app:demo 0.3s done
#23 DONE 1.1s

#24 resolving provenance for metadata file
#24 DONE 0.0s
 Image personal-os-app:demo Built 
time="2026-06-23T10:29:37Z" level=warning msg="volume \"personal-os-wiki-main_personal_os_data\" already exists but was not created by Docker Compose. Use `external: true` to use an existing volume"
time="2026-06-23T10:29:37Z" level=warning msg="volume \"personal-os-wiki-main_personal_os_postgres\" already exists but was not created by Docker Compose. Use `external: true` to use an existing volume"
time="2026-06-23T10:29:37Z" level=warning msg="volume \"personal-os-wiki-main_personal_wiki_data\" already exists but was not created by Docker Compose. Use `external: true` to use an existing volume"
 Container personal-os-wiki-main-personal-os-1 Recreate 
 Container personal-os-wiki-main-personal-os-1 Recreated 
 Container personal-os-wiki-main-personal-os-1 Starting 
 Container personal-os-wiki-main-personal-os-1 Started 
