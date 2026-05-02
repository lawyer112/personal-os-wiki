import { prisma } from "@/lib/db";
import {
  getDailyPlannerPack,
  normalizePlannerMode,
  saveDailyPlanSnapshot,
} from "@/lib/daily-planner";
import {
  handleRouteError,
  json,
  readJson,
  requireReadAccess,
  requireWriteAccess,
} from "@/lib/http";
import { dailyPlanSnapshotSchema } from "@/lib/validation";

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

export async function POST(request: Request) {
  try {
    requireWriteAccess(request);
    const input = await readJson(request, dailyPlanSnapshotSchema);
    const sourcePlannerPacket =
      input.sourcePlannerPacket ??
      (await getDailyPlannerPack(prisma, {
        mode: input.mode,
        appUrl: input.appUrl,
      }));
    const snapshot = await saveDailyPlanSnapshot(
      prisma,
      input,
      sourcePlannerPacket,
    );
    return json({ ok: true, snapshot }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
