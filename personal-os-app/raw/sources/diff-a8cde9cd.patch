diff --git a/personal-os-app/src/app/api/intake/route.ts b/personal-os-app/src/app/api/intake/route.ts
index f7a4d83..4581948 100644
--- a/personal-os-app/src/app/api/intake/route.ts
+++ b/personal-os-app/src/app/api/intake/route.ts
@@ -116,6 +116,23 @@ export async function POST(request: Request) {
     }
 
     const wikiErrors = wikiResults.filter((result) => !result.ok);
+    const wikiWriteStatus = {
+      status:
+        input.wikiNotes.length === 0
+          ? "skipped"
+          : wikiErrors.length === 0
+            ? "ok"
+            : wikiResults.some((result) => result.ok)
+              ? "partial"
+              : "failed",
+      requested: input.wikiNotes.length,
+      succeeded: wikiResults.length - wikiErrors.length,
+      failed: wikiErrors.length,
+      errors: wikiErrors.map((result) => ({
+        title: result.title,
+        error: result.error ?? "Personal Wiki write failed",
+      })),
+    };
     const outputSummary =
       input.agent.outputSummary ??
       ([
@@ -132,7 +149,10 @@ export async function POST(request: Request) {
           .join("，") || "已记录输入。");
 
     await completeAgentRun(prisma, run.id, {
-      classification: input.agent.classification,
+      classification: {
+        ...(input.agent.classification ?? {}),
+        wiki_write_status: wikiWriteStatus,
+      },
       reasoningSummary: input.agent.reasoningSummary,
       outputSummary,
       error:
@@ -192,6 +212,7 @@ export async function POST(request: Request) {
         notes,
         projectEvents,
         wiki: wikiResults,
+        wiki_write_status: wikiWriteStatus,
         notification,
       },
       { status: 201 },
diff --git a/personal-os-app/src/app/wiki/page.tsx b/personal-os-app/src/app/wiki/page.tsx
index 3c0420c..c603f19 100644
--- a/personal-os-app/src/app/wiki/page.tsx
+++ b/personal-os-app/src/app/wiki/page.tsx
@@ -1,5 +1,6 @@
 import Link from "next/link";
-import { personalOsUrl, personalWikiUrl, wikiOpenUrl, wikiUrl } from "@/lib/app-config";
+import { personalOsUrl, personalWikiUrl, wikiOpenUrl } from "@/lib/app-config";
+import { wikiClient } from "@/lib/wiki-client";
 
 type WikiHealth = {
   status?: string;
@@ -178,11 +179,11 @@ export default async function WikiPage() {
 
 async function getWikiHealth(): Promise<WikiHealth> {
   try {
-    const response = await fetch(wikiUrl("/api/health"), { cache: "no-store" });
-    if (!response.ok) {
+    const result = await wikiClient.read<WikiHealth>("/api/health");
+    if (!result.ok) {
       return {};
     }
-    return (await response.json()) as WikiHealth;
+    return result.body ?? {};
   } catch {
     return {};
   }
@@ -190,20 +191,13 @@ async function getWikiHealth(): Promise<WikiHealth> {
 
 async function getRecentNotes(): Promise<WikiNote[]> {
   try {
-    const token = process.env.WIKI_READ_TOKEN;
-    const headers: Record<string, string> = {};
-    if (token) {
-      headers.Authorization = `Bearer ${token}`;
-    }
-    const response = await fetch(wikiUrl("/api/notes?page_size=5"), {
-      headers,
-      cache: "no-store",
-    });
-    if (!response.ok) {
+    const result = await wikiClient.read<{ notes?: WikiNote[] }>(
+      "/api/notes?page_size=5",
+    );
+    if (!result.ok) {
       return [];
     }
-    const body = (await response.json()) as { notes?: WikiNote[] };
-    return body.notes ?? [];
+    return result.body?.notes ?? [];
   } catch {
     return [];
   }
diff --git a/personal-os-app/src/lib/wiki-client.ts b/personal-os-app/src/lib/wiki-client.ts
index 80f5e0e..a429f4a 100644
--- a/personal-os-app/src/lib/wiki-client.ts
+++ b/personal-os-app/src/lib/wiki-client.ts
@@ -27,6 +27,161 @@ type WikiNotesResponse = {
   notes?: WikiNoteSummary[];
 };
 
+export type WikiClientResult<TBody = unknown> = {
+  ok: boolean;
+  status: number;
+  body: TBody | null;
+  url: string;
+};
+
+type WikiClientBaseOptions = Omit<RequestInit, "body" | "headers" | "method"> & {
+  headers?: Record<string, string>;
+};
+
+type WikiReadOptions = WikiClientBaseOptions & {
+  method?: "GET" | "HEAD";
+};
+
+type WikiWriteOptions = WikiClientBaseOptions & {
+  method?: "POST" | "PUT" | "PATCH" | "DELETE";
+  body?: unknown;
+};
+
+type WikiRequestOptions = WikiClientBaseOptions & {
+  method: string;
+  body?: unknown;
+};
+
+const READ_METHODS = new Set(["GET", "HEAD"]);
+const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
+
+function authHeaders(token?: string): Record<string, string> {
+  if (!token) {
+    return {};
+  }
+
+  const scheme = "Bearer";
+  return { Authorization: scheme + " " + token };
+}
+
+function normalizeMethod(method: string) {
+  return method.toUpperCase();
+}
+
+function assertAllowedWikiMethod(
+  method: string,
+  allowed: Set<string>,
+  clientKind: "read" | "write",
+) {
+  if (!allowed.has(method)) {
+    throw new Error(`Personal Wiki ${clientKind} client cannot use ${method}`);
+  }
+}
+
+function assertReadHasNoBody(options: WikiReadOptions) {
+  const unsafeBody = (options as WikiReadOptions & { body?: unknown }).body;
+  if (unsafeBody !== undefined) {
+    throw new Error("Personal Wiki read client cannot send a request body");
+  }
+}
+
+function encodeBody(body: unknown) {
+  if (body === undefined) {
+    return undefined;
+  }
+  if (
+    typeof body === "string" ||
+    body instanceof Blob ||
+    body instanceof FormData ||
+    body instanceof URLSearchParams ||
+    body instanceof ArrayBuffer
+  ) {
+    return body;
+  }
+
+  return JSON.stringify(body);
+}
+
+function jsonHeaders(body: unknown, headers: Record<string, string>) {
+  if (
+    body === undefined ||
+    Object.keys(headers).some((key) => key.toLowerCase() === "content-type")
+  ) {
+    return headers;
+  }
+
+  return { ...headers, "Content-Type": "application/json" };
+}
+
+async function parseBody(response: Response) {
+  const text = await response.text();
+  if (!text) {
+    return null;
+  }
+
+  const contentType = response.headers.get("content-type") ?? "";
+  if (contentType.includes("application/json")) {
+    try {
+      return JSON.parse(text) as unknown;
+    } catch {
+      return text;
+    }
+  }
+
+  return text;
+}
+
+async function requestWiki<TBody>(
+  path: string,
+  token: string | undefined,
+  options: WikiRequestOptions,
+): Promise<WikiClientResult<TBody>> {
+  const { body, headers = {}, method, ...init } = options;
+  const requestHeaders = jsonHeaders(body, {
+    ...authHeaders(token),
+    ...headers,
+  });
+  const url = wikiUrl(path);
+
+  const response = await fetch(url, {
+    cache: init.cache ?? "no-store",
+    ...init,
+    method,
+    headers: requestHeaders,
+    body: encodeBody(body),
+  });
+
+  return {
+    ok: response.ok,
+    status: response.status,
+    body: (await parseBody(response)) as TBody | null,
+    url,
+  };
+}
+
+export const wikiClient = {
+  read<TBody = unknown>(path: string, options: WikiReadOptions = {}) {
+    const method = normalizeMethod(options.method ?? "GET");
+    assertAllowedWikiMethod(method, READ_METHODS, "read");
+    assertReadHasNoBody(options);
+
+    return requestWiki<TBody>(path, process.env.WIKI_READ_TOKEN, {
+      ...options,
+      method,
+      body: undefined,
+    });
+  },
+  write<TBody = unknown>(path: string, options: WikiWriteOptions = {}) {
+    const method = normalizeMethod(options.method ?? "POST");
+    assertAllowedWikiMethod(method, WRITE_METHODS, "write");
+
+    return requestWiki<TBody>(path, process.env.WIKI_API_TOKEN, {
+      ...options,
+      method,
+    });
+  },
+};
+
 export function wikiNoteUrl(path: string) {
   return wikiOpenUrl(`/note?path=${encodeURIComponent(path)}`);
 }
@@ -37,21 +192,14 @@ export async function searchWikiNotes(query: string, pageSize = 8) {
     page: "1",
     page_size: String(pageSize),
   });
-  const token = process.env.WIKI_READ_TOKEN;
-  const headers: Record<string, string> = {};
-  if (token) {
-    headers.Authorization = `Bearer ${token}`;
-  }
 
-  const response = await fetch(wikiUrl(`/api/notes?${params.toString()}`), {
-    headers,
-    cache: "no-store",
-  });
+  const result = await wikiClient.read<WikiNotesResponse>(
+    `/api/notes?${params.toString()}`,
+  );
 
-  if (!response.ok) {
-    throw new Error(`Personal Wiki search failed: ${response.status}`);
+  if (!result.ok) {
+    throw new Error(`Personal Wiki search failed: ${result.status}`);
   }
 
-  const body = (await response.json()) as WikiNotesResponse;
-  return body.notes ?? [];
+  return result.body?.notes ?? [];
 }
diff --git a/personal-os-app/src/lib/wiki-ingest.ts b/personal-os-app/src/lib/wiki-ingest.ts
index e0bb55f..3640e34 100644
--- a/personal-os-app/src/lib/wiki-ingest.ts
+++ b/personal-os-app/src/lib/wiki-ingest.ts
@@ -1,5 +1,5 @@
-import { wikiOpenUrl, wikiUrl } from "@/lib/app-config";
-import type { WikiIngestInput } from "@/lib/validation";
+import { wikiOpenUrl } from "@/lib/app-config";
+import { wikiClient } from "@/lib/wiki-client";
 
 export type WikiIngestResult = {
   ok: boolean;
@@ -10,43 +10,65 @@ export type WikiIngestResult = {
   error?: string;
 };
 
+type WikiIngestResponse = {
+  status?: string;
+  note_path?: string;
+  url?: string;
+  error?: string;
+  message?: string;
+};
+
+type WikiIngestNoteInput = {
+  frontmatter?: {
+    title: string;
+    type: string;
+    created_by: string;
+    source_type: string;
+    tags: string[];
+    created_at?: string;
+    task_id?: string;
+    agent_id?: string;
+    project?: string;
+    last_reviewed?: string;
+    migration?: string;
+  };
+  title?: string;
+  content: string;
+  source_type?: string;
+  source_url?: string;
+  tags?: string[];
+  metadata?: Record<string, unknown>;
+};
+
+const wikiIngestTitle = (input: WikiIngestNoteInput) =>
+  input.frontmatter?.title ?? input.title ?? "untitled-wiki-note";
+
 export async function ingestWikiNote(
-  input: WikiIngestInput,
+  input: WikiIngestNoteInput,
 ): Promise<WikiIngestResult> {
-  const headers: Record<string, string> = {
-    "Content-Type": "application/json",
+  const title = wikiIngestTitle(input);
+  const payload = {
+    ...input,
+    metadata: input.metadata ?? {},
   };
-  const token = process.env.WIKI_API_TOKEN;
-  if (token) {
-    headers.Authorization = `Bearer ${token}`;
-  }
 
   try {
-    const response = await fetch(wikiUrl("/api/ingest"), {
-      method: "POST",
-      headers,
-      body: JSON.stringify(input),
+    const result = await wikiClient.write<WikiIngestResponse>("/api/ingest", {
+      body: payload,
     });
+    const body = result.body ?? {};
 
-    const body = (await response.json().catch(() => ({}))) as {
-      status?: string;
-      note_path?: string;
-      url?: string;
-      error?: string;
-      message?: string;
-    };
-
-    if (!response.ok) {
+    if (!result.ok) {
       return {
         ok: false,
-        title: input.title,
-        error: body.error ?? body.message ?? `Personal Wiki returned ${response.status}`,
+        title,
+        error: body.error ?? body.message ?? `Personal Wiki returned ${result.status}`,
       };
     }
 
     return {
       ok: true,
-      title: input.title,
+      title,
       status: body.status,
       note_path: body.note_path,
       url: body.url ? wikiOpenUrl(body.url) : undefined,
@@ -54,7 +76,7 @@ export async function ingestWikiNote(
   } catch (error) {
     return {
       ok: false,
-      title: input.title,
+      title,
       error: error instanceof Error ? error.message : "Personal Wiki ingest failed",
     };
   }
diff --git a/personal-os-app/tests/routes/intake-wiki-fallback.test.ts b/personal-os-app/tests/routes/intake-wiki-fallback.test.ts
new file mode 100644
index 0000000..36efac4
--- /dev/null
+++ b/personal-os-app/tests/routes/intake-wiki-fallback.test.ts
@@ -0,0 +1,179 @@
+import { afterEach, describe, expect, it, vi } from "vitest";
+
+function intakeRequest(body: unknown) {
+  return new Request("http://os.local/api/intake", {
+    method: "POST",
+    headers: {
+      authorization: "Bearer os-write-token-0000",
+      "content-type": "application/json",
+    },
+    body: JSON.stringify(body),
+  });
+}
+
+async function loadIntakeRoute() {
+  vi.resetModules();
+
+  const mocks = {
+    createInboxItem: vi.fn().mockResolvedValue({ id: "inbox_1" }),
+    startAgentRun: vi.fn().mockResolvedValue({ id: "run_1" }),
+    completeAgentRun: vi.fn().mockResolvedValue({ id: "run_1" }),
+    createNote: vi.fn(),
+    ingestWikiNote: vi.fn().mockResolvedValue({
+      ok: false,
+      title: "Wiki fallback demo",
+      error: "Personal Wiki returned 500",
+    }),
+    createTask: vi.fn().mockResolvedValue({
+      id: "task_1",
+      title: "OS fallback task",
+      status: "todo",
+    }),
+    createIdea: vi.fn(),
+    createProjectEvent: vi.fn(),
+    createTelegramNotification: vi.fn(),
+  };
+
+  vi.doMock("@/lib/db", () => ({
+    prisma: {
+      project: {
+        findUnique: vi.fn(),
+        upsert: vi.fn(),
+      },
+    },
+  }));
+  vi.doMock("@/lib/inbox", () => ({
+    createInboxItem: mocks.createInboxItem,
+    startAgentRun: mocks.startAgentRun,
+    completeAgentRun: mocks.completeAgentRun,
+  }));
+  vi.doMock("@/lib/wiki-ingest", () => ({
+    ingestWikiNote: mocks.ingestWikiNote,
+  }));
+  vi.doMock("@/lib/notes", () => ({
+    createNote: mocks.createNote,
+  }));
+  vi.doMock("@/lib/tasks", () => ({
+    createTask: mocks.createTask,
+  }));
+  vi.doMock("@/lib/ideas", () => ({
+    createIdea: mocks.createIdea,
+  }));
+  vi.doMock("@/lib/projects", () => ({
+    createProjectEvent: mocks.createProjectEvent,
+  }));
+  vi.doMock("@/lib/notifications", () => ({
+    createTelegramNotification: mocks.createTelegramNotification,
+  }));
+
+  const route = await import("@/app/api/intake/route");
+  return { ...route, mocks };
+}
+
+describe("POST /api/intake Wiki fallback", () => {
+  afterEach(() => {
+    vi.unstubAllEnvs();
+    vi.resetModules();
+  });
+
+  it("keeps OS task writes successful when Wiki note ingest returns 500", async () => {
+    vi.stubEnv("NODE_ENV", "production");
+    vi.stubEnv("PERSONAL_OS_API_TOKEN", "os-write-token-0000");
+    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://os.local");
+
+    const { POST, mocks } = await loadIntakeRoute();
+    const response = await POST(
+      intakeRequest({
+        source: {
+          sourceType: "cron",
+          sourcePlatform: "hermes",
+          rawText: "check wiki fallback",
+          attachments: [],
+          createdBy: "hermes",
+        },
+        agent: {
+          model: "hermes-cron",
+          classification: { kind: "verification" },
+          reasoningSummary: "Verify Wiki failure does not block OS writes.",
+        },
+        wikiNotes: [
+          {
+            title: "Wiki fallback demo",
+            content: "Body",
+            source_type: "cron",
+            tags: ["personal-os"],
+            metadata: {},
+          },
+        ],
+        tasks: [
+          {
+            title: "OS fallback task",
+            description: "This task proves /api/intake continued after Wiki failed.",
+            status: "todo",
+            priority: "P0",
+            riskLevel: "low",
+            executionMode: "agent_allowed",
+            agentTags: ["personal-os", "wiki"],
+            nextAction: "Run the focused intake fallback test.",
+            definitionOfDone: "The intake response is 201 and includes the task plus the Wiki failure result.",
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
+    expect(body.tasks).toEqual([
+      { id: "task_1", title: "OS fallback task", status: "todo" },
+    ]);
+    expect(body.wiki).toEqual([
+      {
+        ok: false,
+        title: "Wiki fallback demo",
+        error: "Personal Wiki returned 500",
+      },
+    ]);
+    expect(body.wiki_write_status).toEqual({
+      status: "failed",
+      requested: 1,
+      succeeded: 0,
+      failed: 1,
+      errors: [
+        {
+          title: "Wiki fallback demo",
+          error: "Personal Wiki returned 500",
+        },
+      ],
+    });
+    expect(mocks.createTask).toHaveBeenCalledWith(
+      expect.anything(),
+      expect.objectContaining({
+        title: "OS fallback task",
+        sourceInboxItemId: "inbox_1",
+        sourceAgentRunId: "run_1",
+        wikiLinks: [],
+      }),
+    );
+    expect(mocks.createNote).not.toHaveBeenCalled();
+    expect(mocks.completeAgentRun).toHaveBeenCalledWith(
+      expect.anything(),
+      "run_1",
+      expect.objectContaining({
+        classification: expect.objectContaining({
+          kind: "verification",
+          wiki_write_status: expect.objectContaining({
+            status: "failed",
+            requested: 1,
+            succeeded: 0,
+            failed: 1,
+          }),
+        }),
+        outputSummary: expect.stringContaining("创建 1 个任务"),
+        error: undefined,
+      }),
+    );
+  });
+});
diff --git a/personal-os-app/tests/services/wiki-client.test.ts b/personal-os-app/tests/services/wiki-client.test.ts
new file mode 100644
index 0000000..94b84bb
--- /dev/null
+++ b/personal-os-app/tests/services/wiki-client.test.ts
@@ -0,0 +1,113 @@
+import { afterEach, describe, expect, it, vi } from "vitest";
+
+function jsonResponse(body: unknown, status = 200) {
+  return new Response(JSON.stringify(body), {
+    status,
+    headers: { "content-type": "application/json" },
+  });
+}
+
+async function loadWikiClient() {
+  vi.resetModules();
+  vi.stubEnv("NEXT_PUBLIC_WIKI_URL", "http://wiki.local");
+  vi.stubEnv("WIKI_READ_TOKEN", "read-token-000000");
+  vi.stubEnv("WIKI_API_TOKEN", "write-token-000000");
+  return import("@/lib/wiki-client");
+}
+
+describe("wikiClient", () => {
+  afterEach(() => {
+    vi.unstubAllGlobals();
+    vi.unstubAllEnvs();
+    vi.resetModules();
+  });
+
+  it("uses WIKI_READ_TOKEN for read requests", async () => {
+    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ notes: [] }));
+    vi.stubGlobal("fetch", fetchMock);
+    const { wikiClient } = await loadWikiClient();
+
+    const result = await wikiClient.read<{ notes: unknown[] }>(
+      "/api/notes?page_size=1",
+    );
+
+    expect(result).toMatchObject({ ok: true, status: 200, body: { notes: [] } });
+    expect(fetchMock).toHaveBeenCalledTimes(1);
+    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
+    const scheme = "Bearer";
+    expect(url).toBe("http://wiki.local/api/notes?page_size=1");
+    expect(init.method).toBe("GET");
+    expect(init.cache).toBe("no-store");
+    expect(init.body).toBeUndefined();
+    expect((init.headers as Record<string, string>).Authorization).toBe(
+      `${scheme} read-token-000000`,
+    );
+  });
+
+  it("uses WIKI_API_TOKEN and JSON body for write requests", async () => {
+    const fetchMock = vi
+      .fn()
+      .mockResolvedValue(jsonResponse({ status: "created", note_path: "demo.md" }, 201));
+    vi.stubGlobal("fetch", fetchMock);
+    const { wikiClient } = await loadWikiClient();
+
+    const result = await wikiClient.write<{ status: string; note_path: string }>(
+      "/api/ingest",
+      { body: { title: "Demo", content: "Body" } },
+    );
+
+    expect(result).toMatchObject({
+      ok: true,
+      status: 201,
+      body: { status: "created", note_path: "demo.md" },
+    });
+    expect(fetchMock).toHaveBeenCalledTimes(1);
+    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
+    const headers = init.headers as Record<string, string>;
+    const scheme = "Bearer";
+    expect(url).toBe("http://wiki.local/api/ingest");
+    expect(init.method).toBe("POST");
+    expect(headers.Authorization).toBe(`${scheme} write-token-000000`);
+    expect(headers["Content-Type"]).toBe("application/json");
+    expect(init.body).toBe(JSON.stringify({ title: "Demo", content: "Body" }));
+  });
+
+  it("keeps searchWikiNotes on the read side and surfaces non-ok status", async () => {
+    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "no" }, 401));
+    vi.stubGlobal("fetch", fetchMock);
+    const { searchWikiNotes } = await loadWikiClient();
+
+    await expect(searchWikiNotes("Personal OS", 3)).rejects.toThrow(
+      "Personal Wiki search failed: 401",
+    );
+
+    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
+    const scheme = "Bearer";
+    expect(url).toBe("http://wiki.local/api/notes?q=Personal+OS&page=1&page_size=3");
+    expect((init.headers as Record<string, string>).Authorization).toBe(
+      `${scheme} read-token-000000`,
+    );
+  });
+
+  it("prevents read tokens from being used for writes and write tokens for reads", async () => {
+    const fetchMock = vi.fn();
+    vi.stubGlobal("fetch", fetchMock);
+    const { wikiClient } = await loadWikiClient();
+    const read = wikiClient.read as unknown as (
+      path: string,
+      options: { method: string; body?: unknown },
+    ) => unknown;
+    const write = wikiClient.write as unknown as (
+      path: string,
+      options: { method: string },
+    ) => unknown;
+
+    expect(() =>
+      read("/api/ingest", { method: "POST", body: { title: "Nope" } }),
+    ).toThrow("Personal Wiki read client cannot use POST");
+    expect(() => write("/api/notes", { method: "GET" })).toThrow(
+      "Personal Wiki write client cannot use GET",
+    );
+    expect(fetchMock).not.toHaveBeenCalled();
+  });
+});
diff --git a/personal-os-app/tests/services/wiki-ingest.test.ts b/personal-os-app/tests/services/wiki-ingest.test.ts
new file mode 100644
index 0000000..0688001
--- /dev/null
+++ b/personal-os-app/tests/services/wiki-ingest.test.ts
@@ -0,0 +1,59 @@
+import { afterEach, describe, expect, it, vi } from "vitest";
+
+const wikiInput = {
+  title: "Wiki fallback demo",
+  content: "Body",
+  source_type: "telegram",
+  tags: [],
+  metadata: {},
+};
+
+async function loadWikiIngest(write: ReturnType<typeof vi.fn>) {
+  vi.resetModules();
+  vi.doMock("@/lib/wiki-client", () => ({
+    wikiClient: { write },
+  }));
+  vi.doMock("@/lib/app-config", () => ({
+    wikiOpenUrl: (path: string) => `http://wiki.local${path}`,
+  }));
+
+  return import("@/lib/wiki-ingest");
+}
+
+describe("ingestWikiNote", () => {
+  afterEach(() => {
+    vi.resetModules();
+    vi.doUnmock("@/lib/wiki-client");
+    vi.doUnmock("@/lib/app-config");
+  });
+
+  it("returns a failed result instead of throwing when Wiki rejects writes", async () => {
+    const write = vi.fn().mockResolvedValue({
+      ok: false,
+      status: 401,
+      body: { error: "missing write auth" },
+      url: "http://wiki.local/api/ingest",
+    });
+    const { ingestWikiNote } = await loadWikiIngest(write);
+
+    const result = await ingestWikiNote(wikiInput);
+
+    expect(result).toEqual({
+      ok: false,
+      title: "Wiki fallback demo",
+      error: "missing write auth",
+    });
+    expect(write).toHaveBeenCalledWith("/api/ingest", { body: wikiInput });
+  });
+
+  it("returns a failed result instead of throwing when Wiki is unreachable", async () => {
+    const write = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));
+    const { ingestWikiNote } = await loadWikiIngest(write);
+
+    await expect(ingestWikiNote(wikiInput)).resolves.toEqual({
+      ok: false,
+      title: "Wiki fallback demo",
+      error: "connect ECONNREFUSED",
+    });
+  });
+});
