import { recordActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { handleRouteError, json, readJson, requireReadAccess, requireWriteAccess } from "@/lib/http";
import { activityCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const items = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return json({ ok: true, items });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireWriteAccess(request);
    const input = await readJson(request, activityCreateSchema);
    const item = await recordActivity(prisma, input);
    return json({ ok: true, item }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
