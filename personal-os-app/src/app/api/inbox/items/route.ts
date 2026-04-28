import { createInboxItem } from "@/lib/inbox";
import { handleRouteError, json, readJson, requireReadAccess, requireWriteAccess } from "@/lib/http";
import { prisma } from "@/lib/db";
import { inboxCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const items = await prisma.inboxItem.findMany({
      orderBy: { receivedAt: "desc" },
      take: 100,
      include: {
        agentRuns: { orderBy: { startedAt: "desc" }, take: 1 },
        tasks: true,
        notes: true,
      },
    });
    return json({ ok: true, items });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireWriteAccess(request);
    const input = await readJson(request, inboxCreateSchema);
    const item = await createInboxItem(prisma, input);
    return json({ ok: true, item }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
