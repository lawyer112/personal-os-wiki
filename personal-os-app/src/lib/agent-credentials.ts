import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { HttpError } from "@/lib/http";

const credentialSchema = z.object({
  agentId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  role: z.enum(["worker", "reviewer"]),
  projectIds: z.array(z.string().min(1)).max(100).optional(),
  maxConcurrent: z.number().int().min(1).max(20).default(1),
});
export type AgentPrincipal = z.infer<typeof credentialSchema>;
export function authenticateAgent(headers: Headers, configuration = process.env.PERSONAL_OS_AGENT_CREDENTIALS): AgentPrincipal {
  if (!configuration) throw new HttpError(503, "尚未配置独立智能体凭证");
  let credentials: AgentPrincipal[];
  try {
    credentials = z.array(credentialSchema).min(1).max(200).parse(JSON.parse(configuration));
    if (new Set(credentials.map(item => item.tokenHash)).size !== credentials.length) throw new Error("重复的凭证");
  } catch { throw new HttpError(503, "智能体凭证配置无效，请由管理员检查"); }
  const header = headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ") || header.length > 4096) throw new HttpError(401, "缺少智能体凭证");
  const raw = header.slice(7);
  if (raw.length < 24) throw new HttpError(401, "智能体凭证无效");
  const hash = createHash("sha256").update(raw).digest();
  const matches = credentials.filter(item => timingSafeEqual(hash, Buffer.from(item.tokenHash, "hex")));
  if (matches.length !== 1) throw new HttpError(401, "智能体凭证无效或已撤销");
  return matches[0];
}
export function assertAgentScope(principal: AgentPrincipal, projectId?: string | null) {
  if (principal.projectIds && (!projectId || !principal.projectIds.includes(projectId))) throw new HttpError(403, "此凭证不能访问该项目的任务");
}
export function assertAgentRole(principal: AgentPrincipal, role: "worker" | "reviewer") {
  if (principal.role !== role) throw new HttpError(403, role === "reviewer" ? "执行者不能审批任务，需要独立复核凭证" : "此凭证没有执行权限");
}
export function assertRunBinding(principal: AgentPrincipal, taskId: string, runId: string, run: { id: string; taskId: string; agentId: string; status: string } | null) {
  if (!run || run.id !== runId || run.taskId !== taskId || run.agentId !== principal.agentId || run.status !== "running") throw new HttpError(409, "执行批次已失效，禁止旧执行器继续写入");
}
