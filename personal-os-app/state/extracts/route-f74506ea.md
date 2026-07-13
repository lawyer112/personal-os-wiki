import { prisma } from "@/lib/db";
import { handleRouteError, json, requireReadAccess } from "@/lib/http";
import { getToday } from "@/lib/today";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const today = await getToday(prisma);
    return json({ ok: true, today });
  } catch (error) {
    return handleRouteError(error);
  }
}
