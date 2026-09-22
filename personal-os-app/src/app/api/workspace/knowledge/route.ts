import { z } from "zod";
import { prisma } from "@/lib/db";
import { wikiClient } from "@/lib/wiki-client";
import { requestHasTokenAccess } from "@/lib/auth";
import { handleRouteError, HttpError, json, readJson, requireReadAccess, requireWriteAccess } from "@/lib/http";
import type { KnowledgeCatalog, KnowledgeNote } from "@/lib/knowledge-workspace";
export const dynamic = "force-dynamic";
const editSchema = z.object({
  path: z.string().max(1000).optional(), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  requestId: z.string().regex(/^[A-Za-z0-9_-]{12,100}$/).optional(),
  title: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(200000),
  tags: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  metadata: z.object({ space: z.string().max(160), book: z.string().max(160), chapter: z.string().max(160),
    owner: z.string().max(160), status: z.enum(["draft", "published", "deprecated"]),
    confidence: z.enum(["verified", "inferred", "speculative"]), sensitivity: z.enum(["public", "internal", "private"]),
    valid_until: z.string().max(100).optional(), source_url: z.string().max(500).optional(),
  }).partial(),
});
function writable(request: Request) {
  const token = process.env.PERSONAL_OS_API_TOKEN;
  return token ? requestHasTokenAccess(request.headers, [token]) : process.env.NODE_ENV !== "production";
}
function upstreamError(status: number, body: unknown): never {
  if (status === 404) throw new HttpError(404, "未找到知识页面或版本接口。请确认知识服务也已升级到工作台版本。");
  if (status === 401 || status === 403) throw new HttpError(503, "知识服务凭证不匹配，请检查服务端的知识读取／写入配置。");
  const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "知识服务处理失败，请重试。";
  throw new HttpError(status >= 400 && status < 600 ? status : 502, message);
}
export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    if (path) {
      const params = new URLSearchParams({ path });
      const revision = url.searchParams.get("revision");
      if (revision) params.set("revision", revision);
      const result = await wikiClient.read<{ ok: boolean; note: KnowledgeNote }>(`/api/workspace/note?${params}`, { signal: AbortSignal.timeout(10000) });
      if (!result.ok || !result.body?.note) upstreamError(result.status, result.body);
      const tasks = await prisma.task.findMany({ where: { wikiLinks: { some: { notePath: path } } },
        select: { id: true, title: true, status: true, submittedAt: true }, take: 30, orderBy: { updatedAt: "desc" } });
      return json({ ok: true, note: result.body!.note, writable: writable(request), tasks });
    }
    const params = new URLSearchParams();
    for (const key of ["q", "space", "book", "chapter", "status", "page"]) {
      const value = url.searchParams.get(key);
      if (value) params.set(key, value.slice(0, 200));
    }
    const result = await wikiClient.read<KnowledgeCatalog>(`/api/workspace/notes?${params}`, { signal: AbortSignal.timeout(15000) });
    if (!result.ok || !result.body) upstreamError(result.status, result.body);
    return json({ ...result.body, ok: true, writable: writable(request) });
  } catch (error) { return handleRouteError(error); }
}
export async function POST(request: Request) {
  try {
    requireWriteAccess(request);
    const origin = request.headers.get("origin");
    if (origin && origin !== (process.env.PERSONAL_OS_PUBLIC_ORIGIN || new URL(request.url).origin)) throw new HttpError(403, "不允许跨站更新知识");
    const input = await readJson(request, editSchema);
    if (input.path && !input.expectedRevision) throw new HttpError(400, "修改知识前必须提供所读取的版本编号");
    if (!input.path && !input.requestId) throw new HttpError(400, "创建知识需要请求标识");
    const result = await wikiClient.write<{ ok: boolean; note: KnowledgeNote; indexed: boolean }>("/api/workspace/note", { body: input, signal: AbortSignal.timeout(30000) });
    if (!result.ok || !result.body?.note) upstreamError(result.status, result.body);
    return json(result.body);
  } catch (error) { return handleRouteError(error); }
}
