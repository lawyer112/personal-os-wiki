import { prisma } from "@/lib/db";
import { handleRouteError, json, readJson, requireReadAccess, requireWriteAccess } from "@/lib/http";
import { updateIdea } from "@/lib/ideas";
import { ideaUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireReadAccess(request);
    const { id } = await params;
    const idea = await prisma.idea.findUniqueOrThrow({
      where: { id },
      include: {
        project: true,
        sourceInboxItem: true,
        sourceAgentRun: true,
        promotedTask: true,
      },
    });
    return json({ ok: true, idea });
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
    const input = await readJson(request, ideaUpdateSchema);
    const idea = await updateIdea(prisma, id, input);
    return json({ ok: true, idea });
  } catch (error) {
    return handleRouteError(error);
  }
}
