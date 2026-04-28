import { prisma } from "@/lib/db";
import { handleRouteError, json, requireWriteAccess } from "@/lib/http";
import { getTodayReminder, normalizeReminderMode } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireWriteAccess(request);
    const { searchParams } = new URL(request.url);
    const mode = normalizeReminderMode(searchParams.get("mode"));
    const appUrl = searchParams.get("appUrl") ?? undefined;
    const reminder = await getTodayReminder(prisma, { mode, appUrl });
    return json({ ok: true, reminder });
  } catch (error) {
    return handleRouteError(error);
  }
}
