import { prisma } from "@/lib/db";
import { getDailyPlannerPack, normalizePlannerMode } from "@/lib/daily-planner";
import { handleRouteError, json, requireReadAccess } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const { searchParams } = new URL(request.url);
    const mode = normalizePlannerMode(searchParams.get("mode"));
    const appUrl = searchParams.get("appUrl") ?? undefined;
    const planner = await getDailyPlannerPack(prisma, { mode, appUrl });
    return json({ ok: true, planner });
  } catch (error) {
    return handleRouteError(error);
  }
}
