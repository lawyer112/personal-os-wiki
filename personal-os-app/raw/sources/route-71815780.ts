import { prisma } from "@/lib/db";
import {
  handleRouteError,
  json,
  readJson,
  requireReadAccess,
  requireWriteAccess,
} from "@/lib/http";
import { agentProfileCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const profiles = await prisma.agentProfile.findMany({
      orderBy: [{ enabled: "desc" }, { id: "asc" }],
    });
    return json({ ok: true, profiles });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireWriteAccess(request);
    const input = await readJson(request, agentProfileCreateSchema);
    const profile = await prisma.agentProfile.upsert({
      where: { id: input.id },
      create: input,
      update: {
        displayName: input.displayName,
        tags: input.tags,
        capabilities: input.capabilities,
        allowedRiskLevel: input.allowedRiskLevel,
        canWriteWiki: input.canWriteWiki,
        canWriteTasks: input.canWriteTasks,
        canTouchFiles: input.canTouchFiles,
        canSendNotifications: input.canSendNotifications,
        enabled: input.enabled,
      },
    });
    return json({ ok: true, profile }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
