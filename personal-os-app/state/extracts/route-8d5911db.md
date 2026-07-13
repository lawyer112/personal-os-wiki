import { prisma } from "@/lib/db";
import { handleRouteError, json, readJson, requireReadAccess, requireWriteAccess } from "@/lib/http";
import { createTask, listTasks } from "@/lib/tasks";
import { taskCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const tasks = await listTasks(prisma);
    return json({ ok: true, tasks });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireWriteAccess(request);
    const input = await readJson(request, taskCreateSchema);
    const task = await createTask(prisma, input);
    return json({ ok: true, task }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
