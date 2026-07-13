import { prisma } from "@/lib/db";
import { handleRouteError, json, readJson, requireWriteAccess } from "@/lib/http";
import { startAgentRun } from "@/lib/inbox";
import { agentRunCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireWriteAccess(request);
    const input = await readJson(request, agentRunCreateSchema);
    const run = await startAgentRun(prisma, input);
    return json({ ok: true, run }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
