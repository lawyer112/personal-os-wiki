diff --git a/personal-os-app/src/lib/validation.ts b/personal-os-app/src/lib/validation.ts
index 40b5864..e4205df 100644
--- a/personal-os-app/src/lib/validation.ts
+++ b/personal-os-app/src/lib/validation.ts
@@ -275,15 +275,35 @@ export const dailyPlanSnapshotSchema = z.object({
   sourcePlannerPacket: jsonRecord.optional(),
 });
 
-export const wikiIngestSchema = z.object({
-  title: z.string().min(1),
-  content: z.string().min(1),
-  source_type: z.string().min(1).default("telegram"),
-  source_url: z.string().optional(),
+export const wikiFrontmatterSchema = z.object({
+  title: z.string().min(1).optional(),
+  type: z.string().min(1).default("project"),
+  created_by: z.literal("hermes:worker").default("hermes:worker"),
+  source_type: z.literal("agent-output").default("agent-output"),
   tags: z.array(z.string().min(1)).default([]),
-  metadata: jsonRecord.default({}),
+  created_at: z.string().min(1).optional(),
+  task_id: z.string().min(1).optional(),
+  agent_id: z.string().min(1).optional(),
+  project: z.string().min(1).optional(),
+  last_reviewed: z.string().min(1).optional(),
+  migration: z.string().min(1).optional(),
 });
 
+export const wikiIngestSchema = z
+  .object({
+    title: z.string().min(1).optional(),
+    content: z.string().min(1),
+    source_type: z.string().min(1).optional(),
+    source_url: z.string().optional(),
+    tags: z.array(z.string().min(1)).default([]),
+    metadata: jsonRecord.default({}),
+    frontmatter: wikiFrontmatterSchema.optional(),
+  })
+  .refine((input) => Boolean(input.title ?? input.frontmatter?.title), {
+    message: "Wiki note needs title or frontmatter.title.",
+    path: ["title"],
+  });
+
 export const intakeSchema = z.object({
   source: inboxCreateSchema,
   agent: z.object({
diff --git a/personal-os-app/src/lib/wiki-ingest.ts b/personal-os-app/src/lib/wiki-ingest.ts
index 3640e34..5ab3220 100644
--- a/personal-os-app/src/lib/wiki-ingest.ts
+++ b/personal-os-app/src/lib/wiki-ingest.ts
@@ -1,6 +1,9 @@
 import { wikiOpenUrl } from "@/lib/app-config";
 import { wikiClient } from "@/lib/wiki-client";
 
+const WIKI_CREATED_BY = "hermes:worker";
+const WIKI_SOURCE_TYPE = "agent-output";
+
 export type WikiIngestResult = {
   ok: boolean;
   title: string;
@@ -18,20 +21,36 @@ type WikiIngestResponse = {
   message?: string;
 };
 
+type WikiFrontmatterInput = {
+  title?: string;
+  type?: string;
+  created_by?: string;
+  source_type?: string;
+  tags?: string[];
+  created_at?: string;
+  task_id?: string;
+  agent_id?: string;
+  project?: string;
+  last_reviewed?: string;
+  migration?: string;
+};
+
+type WikiFrontmatter = {
+  title: string;
+  type: string;
+  created_by: typeof WIKI_CREATED_BY;
+  source_type: typeof WIKI_SOURCE_TYPE;
+  tags: string[];
+  created_at?: string;
+  task_id?: string;
+  agent_id?: string;
+  project?: string;
+  last_reviewed?: string;
+  migration?: string;
+};
+
 type WikiIngestNoteInput = {
-  frontmatter?: {
-    title: string;
-    type: string;
-    created_by: string;
-    source_type: string;
-    tags: string[];
-    created_at?: string;
-    task_id?: string;
-    agent_id?: string;
-    project?: string;
-    last_reviewed?: string;
-    migration?: string;
-  };
+  frontmatter?: WikiFrontmatterInput;
   title?: string;
   content: string;
   source_type?: string;
@@ -40,17 +59,105 @@ type WikiIngestNoteInput = {
   metadata?: Record<string, unknown>;
 };
 
-const wikiIngestTitle = (input: WikiIngestNoteInput) =>
-  input.frontmatter?.title ?? input.title ?? "untitled-wiki-note";
+type WikiIngestPayload = WikiIngestNoteInput & {
+  title: string;
+  source_type: string;
+  tags: string[];
+  metadata: Record<string, unknown>;
+  frontmatter: WikiFrontmatter;
+};
 
-export async function ingestWikiNote(
+function compactFrontmatter(frontmatter: WikiFrontmatter): WikiFrontmatter {
+  return Object.fromEntries(
+    Object.entries(frontmatter).filter(([, value]) => value !== undefined),
+  ) as WikiFrontmatter;
+}
+
+function optionalString(value: unknown) {
+  if (typeof value !== "string") {
+    return undefined;
+  }
+  const trimmed = value.trim();
+  return trimmed.length > 0 ? trimmed : undefined;
+}
+
+function metadataString(
+  metadata: Record<string, unknown>,
+  key: string,
+): string | undefined {
+  return optionalString(metadata[key]);
+}
+
+function uniqueTags(...groups: Array<string[] | undefined>) {
+  return [...new Set(groups.flatMap((group) => group ?? []).map((tag) => tag.trim()).filter(Boolean))];
+}
+
+function titleFromContent(content: string) {
+  for (const line of content.split(/\r?\n/)) {
+    const trimmed = line.trim();
+    if (!trimmed) {
+      continue;
+    }
+    const heading = trimmed.match(/^#+\s+(.+)$/)?.[1]?.trim();
+    return (heading ?? trimmed).slice(0, 180);
+  }
+  return undefined;
+}
+
+function wikiIngestTitle(input: WikiIngestNoteInput) {
+  return (
+    optionalString(input.frontmatter?.title) ??
+    optionalString(input.title) ??
+    titleFromContent(input.content) ??
+    "untitled-wiki-note"
+  );
+}
+
+export function buildWikiIngestPayload(
   input: WikiIngestNoteInput,
-): Promise<WikiIngestResult> {
+  now: Date = new Date(),
+): WikiIngestPayload {
+  const metadata = input.metadata ?? {};
   const title = wikiIngestTitle(input);
-  const payload = {
+  const createdAt = optionalString(input.frontmatter?.created_at) ?? now.toISOString();
+  const tags = uniqueTags(input.tags, input.frontmatter?.tags);
+  const frontmatter = compactFrontmatter({
+    title,
+    type: optionalString(input.frontmatter?.type) ?? "project",
+    created_by: WIKI_CREATED_BY,
+    source_type: WIKI_SOURCE_TYPE,
+    tags,
+    created_at: createdAt,
+    task_id:
+      optionalString(input.frontmatter?.task_id) ??
+      metadataString(metadata, "task_id") ??
+      metadataString(metadata, "personal_os_task_id"),
+    agent_id:
+      optionalString(input.frontmatter?.agent_id) ??
+      metadataString(metadata, "agent_id"),
+    project:
+      optionalString(input.frontmatter?.project) ??
+      metadataString(metadata, "project"),
+    last_reviewed:
+      optionalString(input.frontmatter?.last_reviewed) ?? createdAt.slice(0, 10),
+    migration: optionalString(input.frontmatter?.migration),
+  });
+
+  return {
     ...input,
-    metadata: input.metadata ?? {},
+    title,
+    source_type: optionalString(input.source_type) ?? frontmatter.source_type,
+    tags,
+    metadata,
+    frontmatter,
   };
+}
+
+export async function ingestWikiNote(
+  input: WikiIngestNoteInput,
+): Promise<WikiIngestResult> {
+  const payload = buildWikiIngestPayload(input);
+  const title = payload.frontmatter.title;
 
   try {
     const result = await wikiClient.write<WikiIngestResponse>("/api/ingest", {
diff --git a/personal-os-app/tests/routes/intake-wiki-fallback.test.ts b/personal-os-app/tests/routes/intake-wiki-fallback.test.ts
index 36efac4..81fa2f7 100644
--- a/personal-os-app/tests/routes/intake-wiki-fallback.test.ts
+++ b/personal-os-app/tests/routes/intake-wiki-fallback.test.ts
@@ -176,4 +176,106 @@ describe("POST /api/intake Wiki fallback", () => {
       }),
     );
   });
+
+  it("accepts frontmatter-only wikiNotes and links successful Wiki writes to created tasks", async () => {
+    vi.stubEnv("NODE_ENV", "production");
+    vi.stubEnv("PERSONAL_OS_API_TOKEN", "os-write-token-0000");
+    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://os.local");
+
+    const { POST, mocks } = await loadIntakeRoute();
+    mocks.ingestWikiNote.mockResolvedValueOnce({
+      ok: true,
+      title: "Frontmatter contract demo",
+      status: "created",
+      note_path: "notes/2026-06-23/frontmatter-contract-demo.md",
+      url: "http://wiki.local/note?path=notes/2026-06-23/frontmatter-contract-demo.md",
+    });
+
+    const response = await POST(
+      intakeRequest({
+        source: {
+          sourceType: "cron",
+          sourcePlatform: "hermes",
+          rawText: "check frontmatter contract",
+          attachments: [],
+          createdBy: "hermes",
+        },
+        agent: {
+          model: "hermes-cron",
+          classification: { kind: "frontmatter-contract" },
+          reasoningSummary: "Verify frontmatter-only Wiki notes survive intake validation.",
+        },
+        wikiNotes: [
+          {
+            frontmatter: {
+              title: "Frontmatter contract demo",
+              type: "project",
+              created_by: "hermes:worker",
+              source_type: "agent-output",
+              tags: ["personal-os", "frontmatter"],
+              task_id: "task_frontmatter_1",
+            },
+            content: "Body",
+          },
+        ],
+        tasks: [
+          {
+            title: "OS frontmatter contract task",
+            description: "This task proves /api/intake accepts Wiki frontmatter payloads.",
+            status: "todo",
+            priority: "P1",
+            riskLevel: "low",
+            executionMode: "agent_allowed",
+            agentTags: ["personal-os", "wiki"],
+            nextAction: "Run the focused intake frontmatter test.",
+            definitionOfDone: "The intake response is 201 and the created task carries the Wiki link.",
+            wikiLinks: [],
+          },
+        ],
+      }),
+    );
+
+    const body = await response.json();
+
+    expect(response.status).toBe(201);
+    expect(body.ok).toBe(true);
+    expect(body.wiki_write_status).toMatchObject({
+      status: "ok",
+      requested: 1,
+      succeeded: 1,
+      failed: 0,
+    });
+    expect(mocks.ingestWikiNote).toHaveBeenCalledWith(
+      expect.objectContaining({
+        content: "Body",
+        frontmatter: expect.objectContaining({
+          title: "Frontmatter contract demo",
+          created_by: "hermes:worker",
+          source_type: "agent-output",
+          task_id: "task_frontmatter_1",
+        }),
+        metadata: expect.objectContaining({
+          personal_os_inbox_id: "inbox_1",
+          personal_os_agent_run_id: "run_1",
+        }),
+      }),
+    );
+    expect(mocks.createTask).toHaveBeenCalledWith(
+      expect.anything(),
+      expect.objectContaining({
+        title: "OS frontmatter contract task",
+        wikiLinks: [
+          expect.objectContaining({
+            noteTitle: "Frontmatter contract demo",
+            notePath: "notes/2026-06-23/frontmatter-contract-demo.md",
+            noteUrl:
+              "http://wiki.local/note?path=notes/2026-06-23/frontmatter-contract-demo.md",
+            sourceType: "personal-wiki",
+            sourceInboxItemId: "inbox_1",
+            sourceAgentRunId: "run_1",
+          }),
+        ],
+      }),
+    );
+  });
 });
diff --git a/personal-os-app/tests/services/wiki-ingest.test.ts b/personal-os-app/tests/services/wiki-ingest.test.ts
index 0688001..4896a16 100644
--- a/personal-os-app/tests/services/wiki-ingest.test.ts
+++ b/personal-os-app/tests/services/wiki-ingest.test.ts
@@ -43,7 +43,96 @@ describe("ingestWikiNote", () => {
       title: "Wiki fallback demo",
       error: "missing write auth",
     });
-    expect(write).toHaveBeenCalledWith("/api/ingest", { body: wikiInput });
+    const body = write.mock.calls[0]?.[1]?.body;
+    expect(body).toMatchObject({
+      ...wikiInput,
+      title: "Wiki fallback demo",
+      source_type: "telegram",
+      metadata: {},
+      frontmatter: {
+        title: "Wiki fallback demo",
+        type: "project",
+        created_by: "hermes:worker",
+        source_type: "agent-output",
+        tags: [],
+      },
+    });
+    expect(body.frontmatter.created_at).toEqual(expect.any(String));
+    expect(body.frontmatter.last_reviewed).toEqual(expect.any(String));
+  });
+
+  it("sends Personal Wiki frontmatter contract on successful writes", async () => {
+    const write = vi.fn().mockResolvedValue({
+      ok: true,
+      status: 201,
+      body: {
+        status: "created",
+        note_path: "notes/2026-06-23/frontmatter-demo.md",
+        url: "/note?path=notes/2026-06-23/frontmatter-demo.md",
+      },
+      url: "http://wiki.local/api/ingest",
+    });
+    const { ingestWikiNote } = await loadWikiIngest(write);
+
+    const result = await ingestWikiNote({
+      content: "# Frontmatter contract demo\n\nBody",
+      frontmatter: {
+        title: "Frontmatter contract demo",
+        type: "project",
+        created_by: "classic",
+        source_type: "telegram",
+        tags: ["personal-os", "frontmatter"],
+        task_id: "task_frontmatter_1",
+        migration: "frontmatter-contract-v0",
+      },
+      metadata: {
+        agent_id: "obsidianmanager1",
+        project: "Personal OS / Wiki 知识库升级",
+      },
+    });
+
+    expect(result).toEqual({
+      ok: true,
+      title: "Frontmatter contract demo",
+      status: "created",
+      note_path: "notes/2026-06-23/frontmatter-demo.md",
+      url: "http://wiki.local/note?path=notes/2026-06-23/frontmatter-demo.md",
+    });
+
+    const body = write.mock.calls[0]?.[1]?.body;
+    expect(body).toMatchObject({
+      title: "Frontmatter contract demo",
+      source_type: "agent-output",
+      tags: ["personal-os", "frontmatter"],
+      metadata: {
+        agent_id: "obsidianmanager1",
+        project: "Personal OS / Wiki 知识库升级",
+      },
+      frontmatter: {
+        title: "Frontmatter contract demo",
+        type: "project",
+        created_by: "hermes:worker",
+        source_type: "agent-output",
+        tags: ["personal-os", "frontmatter"],
+        task_id: "task_frontmatter_1",
+        agent_id: "obsidianmanager1",
+        project: "Personal OS / Wiki 知识库升级",
+        migration: "frontmatter-contract-v0",
+      },
+    });
+    expect(Object.keys(body.frontmatter).sort()).toEqual([
+      "agent_id",
+      "created_at",
+      "created_by",
+      "last_reviewed",
+      "migration",
+      "project",
+      "source_type",
+      "tags",
+      "task_id",
+      "title",
+      "type",
+    ]);
   });
 
   it("returns a failed result instead of throwing when Wiki is unreachable", async () => {
