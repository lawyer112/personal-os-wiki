import { prisma } from "@/lib/db";
import { handleRouteError, json, readJson, requireWriteAccess } from "@/lib/http";
import { completeAgentRun, createInboxItem, startAgentRun } from "@/lib/inbox";
import { createIdea } from "@/lib/ideas";
import { createTelegramNotification } from "@/lib/notifications";
import { createNote } from "@/lib/notes";
import { createProjectEvent } from "@/lib/projects";
import { createTask } from "@/lib/tasks";
import { ingestWikiNote } from "@/lib/wiki-ingest";
import { intakeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireWriteAccess(request);
    const input = await readJson(request, intakeSchema);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

    const inbox = await createInboxItem(prisma, input.source);
    const run = await startAgentRun(prisma, {
      inboxItemId: inbox.id,
      model: input.agent.model,
      classification: input.agent.classification,
      reasoningSummary: input.agent.reasoningSummary,
    });

    const project = await resolveProject(input.project);

    const wikiResults = await Promise.all(
      input.wikiNotes.map((note) =>
        ingestWikiNote({
          ...note,
          metadata: {
            ...note.metadata,
            personal_os_inbox_id: inbox.id,
            personal_os_agent_run_id: run.id,
            personal_os_project_id: project?.id,
          },
        }),
      ),
    );

    const sharedWikiLinks = wikiResults
      .filter((result) => result.ok)
      .map((result) => ({
        noteTitle: result.title,
        notePath: result.note_path,
        noteUrl: result.url,
        sourceType: "personal-wiki",
        sourceInboxItemId: inbox.id,
        sourceAgentRunId: run.id,
      }));

    const notes = [];
    for (const noteInput of input.notes) {
      notes.push(
        await createNote(prisma, {
          ...noteInput,
          projectIds:
            noteInput.projectIds.length > 0
              ? noteInput.projectIds
              : project?.id
                ? [project.id]
                : [],
          sourceInboxItemId: noteInput.sourceInboxItemId ?? inbox.id,
          sourceAgentRunId: noteInput.sourceAgentRunId ?? run.id,
        }),
      );
    }

    const tasks = [];
    for (const taskInput of input.tasks) {
      tasks.push(
        await createTask(prisma, {
          ...taskInput,
          projectId: taskInput.projectId ?? project?.id,
          sourceInboxItemId: taskInput.sourceInboxItemId ?? inbox.id,
          sourceAgentRunId: taskInput.sourceAgentRunId ?? run.id,
          wikiLinks: [...sharedWikiLinks, ...taskInput.wikiLinks],
        }),
      );
    }

    const ideas = [];
    for (const ideaInput of input.ideas) {
      ideas.push(
        await createIdea(prisma, {
          ...ideaInput,
          projectId: ideaInput.projectId ?? project?.id,
          sourceInboxItemId: ideaInput.sourceInboxItemId ?? inbox.id,
          sourceAgentRunId: ideaInput.sourceAgentRunId ?? run.id,
        }),
      );
    }

    const projectEvents = [];
    for (const eventInput of input.projectEvents) {
      const targetProject =
        eventInput.projectId ??
        (eventInput.projectName
          ? await resolveProject({ name: eventInput.projectName })
          : project)?.id;
      if (!targetProject) {
        continue;
      }
      projectEvents.push(
        await createProjectEvent(prisma, targetProject, {
          title: eventInput.title,
          body: eventInput.body,
          eventType: eventInput.eventType,
          sourceInboxItemId: eventInput.sourceInboxItemId ?? inbox.id,
          sourceAgentRunId: eventInput.sourceAgentRunId ?? run.id,
        }),
      );
    }

    const wikiErrors = wikiResults.filter((result) => !result.ok);
    const outputSummary =
      input.agent.outputSummary ??
      ([
          tasks.length ? `创建 ${tasks.length} 个任务` : null,
          wikiResults.filter((result) => result.ok).length
            ? `写入 ${wikiResults.filter((result) => result.ok).length} 篇知识笔记`
            : null,
          notes.length ? `创建 ${notes.length} 条项目记录` : null,
          ideas.length ? `记录 ${ideas.length} 条想法` : null,
          projectEvents.length ? `记录 ${projectEvents.length} 条项目进展` : null,
          wikiErrors.length ? `${wikiErrors.length} 篇 Wiki 写入失败` : null,
        ]
          .filter(Boolean)
          .join("，") || "已记录输入。");

    await completeAgentRun(prisma, run.id, {
      classification: input.agent.classification,
      reasoningSummary: input.agent.reasoningSummary,
      outputSummary,
      error:
        wikiErrors.length > 0 &&
        tasks.length === 0 &&
        notes.length === 0 &&
        ideas.length === 0 &&
        projectEvents.length === 0
          ? wikiErrors.map((item) => item.error).join("; ")
          : undefined,
    });

    const notification = input.notification
      ? await createTelegramNotification(prisma, {
          recipient: input.notification.recipient,
          projectName: input.notification.projectName ?? project?.name ?? "Personal OS",
          notes: [
            ...notes.map((note) => ({
              id: note.id,
              title: note.title,
              url: appUrl ? `${appUrl}/notes/${note.id}` : undefined,
            })),
            ...wikiResults
              .filter((result) => result.ok)
              .map((result) => ({
                id: result.note_path ?? result.title,
                title: result.title,
                url: result.url,
              })),
          ],
          tasks: tasks.map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            url: appUrl ? `${appUrl}/tasks/${task.id}` : undefined,
          })),
          ideas: ideas.map((idea) => ({
            id: idea.id,
            title: idea.title,
            status: idea.status,
            url: appUrl ? `${appUrl}/ideas` : undefined,
          })),
          appUrl,
          relatedObjectType: "agentRun",
          relatedObjectId: run.id,
        })
      : null;

    return json(
      {
        ok: true,
        inbox,
        agentRunId: run.id,
        project,
        tasks,
        ideas,
        notes,
        projectEvents,
        wiki: wikiResults,
        notification,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

async function resolveProject(project?: {
  id?: string;
  name?: string;
  goal?: string;
  status?: "active" | "waiting" | "blocked" | "paused" | "done" | "archived";
  priority?: "P0" | "P1" | "P2" | "P3";
  currentFocus?: string;
}) {
  if (!project?.id && !project?.name) {
    return null;
  }
  if (project.id) {
    return prisma.project.findUnique({ where: { id: project.id } });
  }

  return prisma.project.upsert({
    where: { name: project.name },
    update: {
      goal: project.goal,
      status: project.status,
      priority: project.priority,
      currentFocus: project.currentFocus,
    },
    create: {
      name: project.name as string,
      goal: project.goal,
      status: project.status ?? "active",
      priority: project.priority ?? "P2",
      currentFocus: project.currentFocus,
    },
  });
}
