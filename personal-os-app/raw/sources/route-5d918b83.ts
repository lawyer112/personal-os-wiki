import { prisma } from "@/lib/db";
import { handleRouteError, json, readJson, requireReadAccess, requireWriteAccess } from "@/lib/http";
import { createNote } from "@/lib/notes";
import { noteCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const notes = await prisma.note.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        projects: { include: { project: true } },
      },
    });
    return json({ ok: true, notes });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireWriteAccess(request);
    const input = await readJson(request, noteCreateSchema);
    const note = await createNote(prisma, input);
    return json({ ok: true, note }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
