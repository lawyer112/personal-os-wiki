import { prisma } from "@/lib/db";
import { getAgentContext, getQueryAgentContext } from "@/lib/agent-context";
import {
  handleRouteError,
  HttpError,
  json,
  readJson,
  requireReadAccess,
} from "@/lib/http";
import { agentContextRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const parseBudgetTokens = (value: string | null) => {
  if (value === null) {
    return undefined;
  }

  const budgetTokens = Number(value);
  if (!Number.isInteger(budgetTokens) || budgetTokens <= 0) {
    throw new HttpError(400, "budget must be a positive integer");
  }

  return budgetTokens;
};

export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");
    const query = searchParams.get("q");
    const budgetTokens = parseBudgetTokens(searchParams.get("budget"));

    if (taskId) {
      const context = await getAgentContext(prisma, taskId, { budgetTokens });
      return json({ ok: true, context });
    }

    if (query) {
      const context = await getQueryAgentContext(query, prisma, {
        budgetTokens,
      });
      return json({
        ok: true,
        context,
      });
    }

    throw new HttpError(400, "taskId or q is required");
  } catch (error) {
    return handleRouteError(error);
  }
}

export const POST = async (request: Request) => {
  try {
    requireReadAccess(request);
    const input = await readJson(request, agentContextRequestSchema);
    const requiredRefs = [...input.required_refs, ...input.requiredRefs].map(
      (ref) => ({
        memoryId: ref.memory_id ?? ref.memoryId,
        path: ref.path,
        title: ref.title,
        version: ref.version,
        chunkId: ref.chunk_id ?? ref.chunkId,
        onMissing: ref.onMissing ?? ref.on_missing,
      }),
    );
    const budgetTokens =
      typeof input.budget === "number" ? input.budget : input.budget?.tokens;
    const context = await getQueryAgentContext(input.query, prisma, {
      scope: input.scope,
      requiredRefs,
      topK: input.top_k ?? input.topK,
      budgetTokens,
    });

    return json({ ok: true, context });
  } catch (error) {
    return handleRouteError(error);
  }
};
