import { prisma } from "@/lib/db";
import { handleRouteError, json, readJson, requireReadAccess, requireWriteAccess } from "@/lib/http";
import { updateTask } from "@/lib/tasks";
import { taskUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireReadAccess(request);
    const { id } = await params;
    const task = await prisma.task.findUniqueOrThrow({
      where: { id },
      include: {
        project: true,
        sourceInboxItem: true,
        sourceAgentRun: true,
        wikiLinks: true,
      },
    });
    return json({ ok: true, task });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireWriteAccess(request);
    const { id } = await params;
    const input = await readJson(request, taskUpdateSchema);
    const task = await updateTask(prisma, id, input);
    return json({ ok: true, task });
  } catch (error) {
    return handleRouteError(error);
  }
}
