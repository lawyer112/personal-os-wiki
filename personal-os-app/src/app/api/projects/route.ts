import { prisma } from "@/lib/db";
import { handleRouteError, json, readJson, requireReadAccess, requireWriteAccess } from "@/lib/http";
import { createProject } from "@/lib/projects";
import { projectCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const projects = await prisma.project.findMany({
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      include: {
        tasks: {
          orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
          take: 5,
        },
      },
    });
    return json({ ok: true, projects });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireWriteAccess(request);
    const input = await readJson(request, projectCreateSchema);
    const project = await createProject(prisma, input);
    return json({ ok: true, project }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
