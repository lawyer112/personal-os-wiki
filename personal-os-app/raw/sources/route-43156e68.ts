import { prisma } from "@/lib/db";
import { submitTask } from "@/lib/agent-tasks";
import { handleRouteError, json, readJson, requireWriteAccess } from "@/lib/http";
import { taskSubmitSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireWriteAccess(request);
    const { id } = await params;
    const input = await readJson(request, taskSubmitSchema);
    const result = await submitTask(prisma, id, input);
    return json({ ok: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
