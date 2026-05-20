import { prisma } from "@/lib/db";
import { recordActivity } from "@/lib/activity";
import { submitTask } from "@/lib/agent-tasks";
import { handleRouteError, json, readJson, requireWriteAccess } from "@/lib/http";
import { taskSubmitSchema } from "@/lib/validation";
import type { TaskSubmitInput } from "@/lib/validation";
import { ingestWikiNote } from "@/lib/wiki-ingest";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireWriteAccess(request);
    const { id } = await params;
    const input = await readJson(request, taskSubmitSchema);
    const result = await submitTask(prisma, id, input);
    const wiki = await writeSubmitSummary(id, input, result);
    return json({ ok: true, ...result, wiki });
  } catch (error) {
    return handleRouteError(error);
  }
}

type SubmitInput = TaskSubmitInput;

type SubmitResult = {
  task?: {
    id?: string;
    title?: string;
    agentTags?: string[];
    tags?: string[];
    projectName?: string | null;
    project?: { name?: string | null } | null;
  };
};

const writeSubmitSummary = async (
  taskId: string,
  input: SubmitInput,
  result: SubmitResult,
) => {
  const task = result.task ?? {};
  const resolvedTaskId = task.id ?? taskId;
  const title = task.title ?? `Task ${resolvedTaskId}`;
  const project =
    task.project?.name ?? task.projectName ?? `task-${resolvedTaskId}`;
  const wikiResult = await ingestWikiNote({
    frontmatter: {
      title: `${title} — 完成总结`,
      type: "project",
      created_by: "hermes:worker",
      agent_id: input.agentId,
      task_id: resolvedTaskId,
      project,
      source_type: "agent-output",
      tags: task.agentTags ?? task.tags ?? [],
    },
    content: submitSummaryContent(resolvedTaskId, input),
  }).catch((error: unknown) => ({
    ok: false,
    title: `${title} — 完成总结`,
    error: error instanceof Error ? error.message : "Personal Wiki ingest failed",
  }));

  if (!wikiResult.ok) {
    await recordActivity(prisma, {
      actorType: "system",
      actorId: input.agentId,
      action: "wiki-write-failed",
      targetType: "task",
      targetId: resolvedTaskId,
      after: {
        reason: wikiResult.error ?? "unknown",
      },
    });
  }

  return wikiResult;
};

const submitSummaryContent = (taskId: string, input: SubmitInput) => {
  const links = [
    ...input.artifactUrls.map((url) => `- Artifact: ${url}`),
    ...input.evidenceLinks.map((url) => `- Evidence: ${url}`),
    `- Personal OS task: ${taskUrl(taskId)}`,
  ];
  return `${input.summary}\n\n## Links\n\n${links.join("\n")}`;
};

const taskUrl = (taskId: string) => {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return appUrl ? `${appUrl}/tasks/${taskId}` : `/tasks/${taskId}`;
};
