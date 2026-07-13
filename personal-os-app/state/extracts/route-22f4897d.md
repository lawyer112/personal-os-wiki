import { prisma } from "@/lib/db";
import { handleRouteError, json, requireReadAccess } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? undefined;
    const mode = searchParams.get("mode") ?? undefined;
    const limit = Math.min(
      Number.parseInt(searchParams.get("limit") ?? "10", 10) || 10,
      50,
    );
    const snapshots = await prisma.dailyPlan.findMany({
      where: {
        ...(date ? { date } : {}),
        ...(mode ? { mode } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return json({ ok: true, snapshots });
  } catch (error) {
    return handleRouteError(error);
  }
}
