import { prisma } from "@/lib/db";
import { heartbeatTask } from "@/lib/agent-tasks";
import { handleRouteError, json, readJson, requireWriteAccess } from "@/lib/http";
import { taskHeartbeatSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireWriteAccess(request);
    const { id } = await params;
    const input = await readJson(request, taskHeartbeatSchema);
    const task = await heartbeatTask(prisma, id, input);
    return json({ ok: true, task });
  } catch (error) {
    return handleRouteError(error);
  }
}
