import { prisma } from "@/lib/db";
import { handleRouteError, json, readJson, requireWriteAccess } from "@/lib/http";
import { completeAgentRun, createInboxItem, startAgentRun } from "@/lib/inbox";
import { createIdea } from "@/lib/ideas";
import { createTelegramNotification } from "@/lib/notifications";
import { createNote } from "@/lib/notes";
import { createProjectEvent } from "@/lib/projects";
import { createTask } from "@/lib/tasks";
import { intakeSchema, type IntakeInput } from "@/lib/validation";
import {
  buildWikiWriteStatus,
  queueWikiWriteJobs,
  wikiWriteJobResponse,
  type WikiWriteJobDb,
} from "@/lib/wiki-write-jobs";

export const dynamic = "force-dynamic";

type IntakeDb = WikiWriteJobDb & {
  inboxItem: unknown;
  agentRun: unknown;
  project: unknown;
  task: unknown;
  idea: unknown;
  note: unknown;
  projectEvent: unknown;
  notification: unknown;
};

type ResolvedProject = {
  id: string;
  name?: string | null;
} | null;

type TransactionCapableDb = {
  $transaction?<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
};

export async function POST(request: Request) {
  try {
    requireWriteAccess(request);
    const input = await readJson(request, intakeSchema);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

    const body = await runIntakeTransaction(input, appUrl);
    return json(body, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function runIntakeTransaction(input: IntakeInput, appUrl: string) {
  const db = prisma as unknown as IntakeDb & TransactionCapableDb;
  if (typeof db.$transaction === "function") {
    return db.$transaction((tx) => persistIntake(tx as IntakeDb, input, appUrl));
  }
  return persistIntake(db, input, appUrl);
}

async function persistIntake(db: IntakeDb, input: IntakeInput, appUrl: string) {
  const inbox = await createInboxItem(db, input.source);
  const run = await startAgentRun(db, {
    inboxItemId: inbox.id,
    model: input.agent.model,
    classification: input.agent.classification,
    reasoningSummary: input.agent.reasoningSummary,
  });

  const project = await resolveProject(db, input.project);

  const wikiJobs = await queueWikiWriteJobs(db, input.wikiNotes, {
    inboxId: inbox.id,
    agentRunId: run.id,
    projectId: project?.id,
  });

  const notes = [];
  for (const noteInput of input.notes) {
    notes.push(
      await createNote(db, {
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
      await createTask(db, {
        ...taskInput,
        projectId: taskInput.projectId ?? project?.id,
        sourceInboxItemId: taskInput.sourceInboxItemId ?? inbox.id,
        sourceAgentRunId: taskInput.sourceAgentRunId ?? run.id,
        wikiLinks: taskInput.wikiLinks,
      }),
    );
  }

  const ideas = [];
  for (const ideaInput of input.ideas) {
    ideas.push(
      await createIdea(db, {
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
        ? await resolveProject(db, { name: eventInput.projectName })
        : project)?.id;
    if (!targetProject) {
      continue;
    }
    projectEvents.push(
      await createProjectEvent(db, targetProject, {
        title: eventInput.title,
        body: eventInput.body,
        eventType: eventInput.eventType,
        sourceInboxItemId: eventInput.sourceInboxItemId ?? inbox.id,
        sourceAgentRunId: eventInput.sourceAgentRunId ?? run.id,
      }),
    );
  }

  const wikiWriteStatus = buildWikiWriteStatus(input.wikiNotes.length, wikiJobs);
  const outputSummary =
    input.agent.outputSummary ??
    ([
      tasks.length ? `创建 ${tasks.length} 个任务` : null,
      wikiJobs.length ? `排队 ${wikiJobs.length} 篇 Wiki 写入` : null,
      notes.length ? `创建 ${notes.length} 条项目记录` : null,
      ideas.length ? `记录 ${ideas.length} 条想法` : null,
      projectEvents.length ? `记录 ${projectEvents.length} 条项目进展` : null,
    ]
      .filter(Boolean)
      .join("，") || "已记录输入。");

  await completeAgentRun(db, run.id, {
    classification: {
      ...(input.agent.classification ?? {}),
      wiki_write_status: wikiWriteStatus,
    },
    reasoningSummary: input.agent.reasoningSummary,
    outputSummary,
  });

  const notification = input.notification
    ? await createTelegramNotification(db, {
        recipient: input.notification.recipient,
        projectName: input.notification.projectName ?? project?.name ?? "Personal OS",
        notes: [
          ...notes.map((note) => ({
            id: note.id,
            title: note.title,
            url: appUrl ? `${appUrl}/notes/${note.id}` : undefined,
          })),
          ...wikiJobs.map((job) => ({
            id: job.id,
            title: job.title,
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

  return {
    ok: true,
    inbox,
    agentRunId: run.id,
    project,
    tasks,
    ideas,
    notes,
    projectEvents,
    wiki: wikiJobs.map(wikiWriteJobResponse),
    wiki_write_status: wikiWriteStatus,
    notification,
  };
}

async function resolveProject(db: IntakeDb, project?: {
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
  const projectDelegate = db.project as {
    findUnique(args: unknown): Promise<ResolvedProject>;
    upsert(args: unknown): Promise<ResolvedProject>;
  };
  if (project.id) {
    return projectDelegate.findUnique({ where: { id: project.id } });
  }

  return projectDelegate.upsert({
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
