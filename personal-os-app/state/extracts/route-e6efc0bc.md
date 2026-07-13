import { prisma } from "@/lib/db";
import { handleRouteError, json, readJson, requireWriteAccess } from "@/lib/http";
import { completeAgentRun } from "@/lib/inbox";
import { agentRunCompleteSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireWriteAccess(request);
    const { id } = await params;
    const input = await readJson(request, agentRunCompleteSchema);
    const run = await completeAgentRun(prisma, id, input);
    return json({ ok: true, run });
  } catch (error) {
    return handleRouteError(error);
  }
}
