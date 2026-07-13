import { prisma } from "@/lib/db";
import { handleRouteError, json, readJson, requireWriteAccess } from "@/lib/http";
import { createProjectEvent } from "@/lib/projects";
import { projectEventCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireWriteAccess(request);
    const { id } = await params;
    const input = await readJson(request, projectEventCreateSchema);
    const event = await createProjectEvent(prisma, id, input);
    return json({ ok: true, event }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
