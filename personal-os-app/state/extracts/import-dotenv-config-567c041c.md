diff --git a/personal-os-app/docker-compose.prod.yml b/personal-os-app/docker-compose.prod.yml
index 4da9e2d..15c7f23 100644
--- a/personal-os-app/docker-compose.prod.yml
+++ b/personal-os-app/docker-compose.prod.yml
@@ -36,7 +36,35 @@ services:
       NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL:?set NEXT_PUBLIC_APP_URL}
       NEXT_PUBLIC_WIKI_URL: ${NEXT_PUBLIC_WIKI_URL:?set NEXT_PUBLIC_WIKI_URL}
     ports:
-      - "127.0.0.1:3100:3000"
+      - "0.0.0.0:3100:3000"
+    volumes:
+      - personal_os_data:/app/data
+
+  wiki-worker:
+    build:
+      context: .
+      args:
+        HTTP_PROXY: ${HTTP_PROXY:-}
+        HTTPS_PROXY: ${HTTPS_PROXY:-}
+        NPM_CONFIG_REGISTRY: ${NPM_CONFIG_REGISTRY:-https://registry.npmmirror.com}
+    command:
+      - node
+      - scripts/process-wiki-write-jobs.mjs
+      - --loop
+      - --limit=10
+      - --interval-ms=5000
+      - --worker-id=wiki-worker-prod
+    restart: unless-stopped
+    depends_on:
+      postgres:
+        condition: service_healthy
+    environment:
+      DATABASE_URL: postgresql://personal_os:${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD}@postgres:5432/personal_os?schema=public
+      WIKI_API_TOKEN: ${WIKI_API_TOKEN:?set WIKI_API_TOKEN}
+      NEXT_PUBLIC_WIKI_URL: ${NEXT_PUBLIC_WIKI_URL:?set NEXT_PUBLIC_WIKI_URL}
+      WIKI_WRITE_JOB_LIMIT: 10
+      WIKI_WRITE_JOB_INTERVAL_MS: 5000
+      WIKI_WRITE_WORKER_ID: wiki-worker-prod
     volumes:
       - personal_os_data:/app/data
 
diff --git a/personal-os-app/scripts/process-wiki-write-jobs.mjs b/personal-os-app/scripts/process-wiki-write-jobs.mjs
index dc6b006..bf8793d 100644
--- a/personal-os-app/scripts/process-wiki-write-jobs.mjs
+++ b/personal-os-app/scripts/process-wiki-write-jobs.mjs
@@ -1,7 +1,5 @@
 #!/usr/bin/env node
 
-import "dotenv/config";
-
 import { readFile } from "node:fs/promises";
 import process from "node:process";
 
