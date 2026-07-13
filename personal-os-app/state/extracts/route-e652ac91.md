import { prisma } from "@/lib/db";
import { getAgentContext, getQueryAgentContext } from "@/lib/agent-context";
import { handleRouteError, HttpError, json, requireReadAccess } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");
    const query = searchParams.get("q");

    if (taskId) {
      const context = await getAgentContext(prisma, taskId);
      return json({ ok: true, context });
    }

    if (query) {
      const context = await getQueryAgentContext(query, prisma);
      return json({
        ok: true,
        context,
      });
    }

    throw new HttpError(400, "taskId or q is required");
  } catch (error) {
    return handleRouteError(error);
  }
}
