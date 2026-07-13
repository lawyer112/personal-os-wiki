import { prisma } from "@/lib/db";
import { addTaskContribution } from "@/lib/agent-tasks";
import { handleRouteError, json, readJson, requireWriteAccess } from "@/lib/http";
import { taskContributionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireWriteAccess(request);
    const { id } = await params;
    const input = await readJson(request, taskContributionSchema);
    const result = await addTaskContribution(prisma, id, input);
    return json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
