import { prisma } from "@/lib/db";
import { handleRouteError, json, readJson, requireWriteAccess } from "@/lib/http";
import { createTelegramNotification } from "@/lib/notifications";
import { telegramNotificationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireWriteAccess(request);
    const input = await readJson(request, telegramNotificationSchema);
    const result = await createTelegramNotification(prisma, input);
    return json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
