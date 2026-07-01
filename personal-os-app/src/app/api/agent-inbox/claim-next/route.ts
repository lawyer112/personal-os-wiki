import { claimNextTask } from "@/lib/agent-tasks";
import { prisma } from "@/lib/db";
import { handleRouteError, json, readJson, requireWriteAccess } from "@/lib/http";
import { agentInboxClaimNextSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireWriteAccess(request);
    const input = await readJson(request, agentInboxClaimNextSchema);
    const result = await claimNextTask(prisma, input);
    return json({ ok: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
