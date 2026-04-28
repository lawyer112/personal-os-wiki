import { prisma } from "@/lib/db";
import { handleRouteError, json, requireWriteAccess } from "@/lib/http";
import { completeTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireWriteAccess(request);
    const { id } = await params;
    const task = await completeTask(prisma, id);
    return json({ ok: true, task });
  } catch (error) {
    return handleRouteError(error);
  }
}
