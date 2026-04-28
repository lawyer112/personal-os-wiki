import { prisma } from "@/lib/db";
import { handleRouteError, json, readJson, requireReadAccess, requireWriteAccess } from "@/lib/http";
import { createIdea, listIdeas } from "@/lib/ideas";
import { ideaCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const ideas = await listIdeas(prisma);
    return json({ ok: true, ideas });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireWriteAccess(request);
    const input = await readJson(request, ideaCreateSchema);
    const idea = await createIdea(prisma, input);
    return json({ ok: true, idea }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
