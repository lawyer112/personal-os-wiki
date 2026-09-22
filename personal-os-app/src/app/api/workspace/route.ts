import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handleRouteError, HttpError, json, requireReadAccess } from "@/lib/http";
import { requestHasTokenAccess } from "@/lib/auth";
import { wikiClient } from "@/lib/wiki-client";
import { claimReasons, readWorkspaceQuery } from "@/lib/workspace";

export const dynamic = "force-dynamic";
const taskSelect = { id: true, title: true, description: true, status: true, priority: true, riskLevel: true,
  executionMode: true, agentTags: true, ownerAgent: true, leaseUntil: true, lastHeartbeatAt: true,
  nextAction: true, definitionOfDone: true, dueDate: true, submittedAt: true, updatedAt: true,
  project: { select: { id: true, name: true } } } satisfies Prisma.TaskSelect;
function canWrite(request: Request) {
  const token = process.env.PERSONAL_OS_API_TOKEN;
  return token ? requestHasTokenAccess(request.headers, [token]) : process.env.NODE_ENV !== "production";
}
export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "tasks";
    const writable = canWrite(request);
    if (view === "task") {
      const id = url.searchParams.get("id");
      if (!id) throw new HttpError(400, "缺少任务编号");
      const task = await prisma.task.findUniqueOrThrow({ where: { id }, include: {
        project: true, wikiLinks: true,
        claims: { orderBy: { claimedAt: "desc" }, take: 30 },
        runs: { orderBy: { startedAt: "desc" }, take: 30 },
        agentActionLogs: { orderBy: { createdAt: "desc" }, take: 30 },
        contributions: { orderBy: { createdAt: "desc" }, take: 30 },
        artifacts: { orderBy: { createdAt: "desc" }, take: 30 },
        reviews: { orderBy: { createdAt: "desc" }, take: 30 },
      }});
      const agents = await prisma.agentProfile.findMany({ orderBy: { displayName: "asc" } });
      return json({ ok: true, task, agents, writable, historyLimit: 30, asOf: new Date().toISOString() });
    }
    if (view === "tasks") {
      const query = readWorkspaceQuery(url);
      const where: Prisma.TaskWhereInput = {};
      if (query.q) where.OR = ["title", "description", "nextAction"].map(field => ({ [field]: { contains: query.q, mode: "insensitive" } }));
      if (query.stage === "intake" || query.stage === "submitted") {
        where.status = "review";
        where.submittedAt = query.stage === "intake" ? null : { not: null };
      } else if (query.stage !== "all") where.status = { equals: query.stage as "todo" | "doing" | "waiting" | "blocked" | "done" | "archived" };
      else where.status = { not: "archived" };
      if (query.project) where.projectId = query.project;
      if (query.owner) where.ownerAgent = query.owner === "unassigned" ? null : query.owner;
      const [projects, agents] = await Promise.all([
        prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
        prisma.agentProfile.findMany({ orderBy: { displayName: "asc" } }),
      ]);
      const agent = agents.find(a => a.id === query.agent);
      if (query.claimable) {
        if (!agent || !agent.enabled || !agent.canWriteTasks) return json({ ok: true, tasks: [], total: 0, page: query.page, pageSize: query.pageSize, projects, agents, writable, asOf: new Date().toISOString() });
        const tags = agent.tags.length ? { OR: [{ agentTags: { isEmpty: true } }, { agentTags: { hasSome: agent.tags } }] } : { agentTags: { isEmpty: true } };
        where.AND = [{ status: { in: ["todo", "doing"] }, executionMode: "agent_allowed", riskLevel: { in: agent.allowedRiskLevel === "low" ? ["low"] : ["low", "medium"] } },
          { OR: [{ ownerAgent: null }, { leaseUntil: { lt: new Date() } }] }, tags];
      }
      const [total, rows] = await prisma.$transaction([
        prisma.task.count({ where }), prisma.task.findMany({ where, select: taskSelect,
          orderBy: [{ priority: "asc" }, { updatedAt: "desc" }, { id: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      ]);
      const tasks = rows.map(task => ({ ...task, description: task.description?.slice(0, 280), nextAction: task.nextAction.slice(0, 280),
        definitionOfDone: task.definitionOfDone.slice(0, 500), claimReasons: claimReasons(task, agent) }));
      return json({ ok: true, tasks, total, page: query.page, pageSize: query.pageSize, projects, agents, writable, asOf: new Date().toISOString() });
    }
    if (view === "projects") {
      const [projects, counts] = await Promise.all([
        prisma.project.findMany({ include: { _count: { select: { tasks: true } } }, orderBy: [{ priority: "asc" }, { updatedAt: "desc" }] }),
        prisma.task.groupBy({ by: ["projectId", "status"], _count: { _all: true } }),
      ]);
      return json({ ok: true, projects, counts, writable });
    }
    if (view === "agents") {
      const [agents, tasks, runs] = await Promise.all([
        prisma.agentProfile.findMany({ orderBy: { displayName: "asc" } }),
        prisma.task.findMany({ where: { ownerAgent: { not: null }, status: { in: ["doing", "waiting", "blocked", "review"] } }, select: taskSelect, take: 200, orderBy: { updatedAt: "desc" } }),
        prisma.taskRun.findMany({ take: 30, orderBy: { startedAt: "desc" }, select: { id: true, agentId: true, taskId: true, status: true, startedAt: true, lastHeartbeatAt: true, endedAt: true, resultSummary: true } }),
      ]);
      return json({ ok: true, agents, tasks, runs, writable, taskLimit: 200, asOf: new Date().toISOString() });
    }
    if (view === "overview") {
      const [counts, submitted, tasks, activity, projects, expired] = await Promise.all([
        prisma.task.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.task.count({ where: { status: "review", submittedAt: { not: null } } }),
        prisma.task.findMany({ where: { status: { in: ["doing", "blocked", "review", "todo"] } }, select: taskSelect, orderBy: [{ priority: "asc" }, { updatedAt: "desc" }], take: 12 }),
        prisma.activityLog.findMany({ take: 12, orderBy: { createdAt: "desc" } }),
        prisma.project.count({ where: { status: "active" } }),
        prisma.task.count({ where: { status: "doing", ownerAgent: { not: null }, leaseUntil: { lt: new Date() } } }),
      ]);
      return json({ ok: true, counts, submitted, tasks, activity, projects, expired, writable, asOf: new Date().toISOString() });
    }
    if (view === "system") {
      const [database, wiki] = await Promise.all([
        prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
        wikiClient.read<{ status?: string; notes?: number }>("/api/health", { signal: AbortSignal.timeout(5000) }).then(r => ({ ok: r.ok && r.body?.status === "ok", notes: r.body?.notes ?? 0 })).catch(() => ({ ok: false, notes: 0 })),
      ]);
      return json({ ok: true, database, wiki, writable, configured: {
        read: Boolean(process.env.PERSONAL_OS_READ_TOKEN), write: Boolean(process.env.PERSONAL_OS_API_TOKEN),
        wikiRead: Boolean(process.env.WIKI_READ_TOKEN), wikiWrite: Boolean(process.env.WIKI_API_TOKEN),
        agentCredentials: hasAgentCredentials(),
      }, asOf: new Date().toISOString() });
    }
    throw new HttpError(400, "不支持的工作台视图");
  } catch (error) { return handleRouteError(error); }
}

function hasAgentCredentials() {
  try { const credentials: unknown = JSON.parse(process.env.PERSONAL_OS_AGENT_CREDENTIALS || "[]"); return Array.isArray(credentials) && credentials.length > 0; } catch { return false; }
}
