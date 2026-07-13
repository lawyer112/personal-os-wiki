import { prisma } from "@/lib/db";
import { listAgentInboxTasks } from "@/lib/agent-tasks";
import { handleRouteError, json, requireWriteAccess } from "@/lib/http";
import { agentInboxQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireWriteAccess(request);
    const { searchParams } = new URL(request.url);
    const tags = (searchParams.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const input = agentInboxQuerySchema.parse({
      agentId: searchParams.get("agent_id") ?? searchParams.get("agentId"),
      tags,
      limit: searchParams.get("limit") ?? undefined,
    });
    const tasks = await listAgentInboxTasks(prisma, input);

    return json({
      ok: true,
      agentId: input.agentId,
      tags: input.tags,
      tasks: tasks.map((task) => {
        const record = task as Record<string, unknown> & { id: string };
        return {
          ...record,
          contextUrl: `/api/agent/context?taskId=${encodeURIComponent(
            record.id,
          )}`,
        };
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
