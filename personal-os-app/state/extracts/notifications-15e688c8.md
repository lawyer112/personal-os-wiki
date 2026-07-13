import type { TelegramNotificationInput } from "@/lib/validation";
import { formatTaskStatus } from "@/lib/task-labels";

type NotificationDb = {
  notification: unknown;
  activityLog: unknown;
};

export function buildTelegramPayload(input: TelegramNotificationInput) {
  const appUrl = input.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const cleanAppUrl = appUrl.replace(/\/$/, "");
  const noteLine =
    input.notes.length > 0 ? `生成 ${input.notes.length} 篇笔记` : "没有新笔记";
  const taskLine =
    input.tasks.length > 0 ? `生成 ${input.tasks.length} 个任务` : "没有新任务";
  const ideaLine =
    input.ideas.length > 0 ? `记录 ${input.ideas.length} 条想法` : "没有新想法";

  const taskLines = input.tasks
    .map((task) => `- [${formatTaskStatus(task.status ?? "review")}] ${task.title}`)
    .join("\n");
  const noteLines = input.notes.map((note) => `- ${note.title}`).join("\n");
  const ideaLines = input.ideas
    .map((idea) => `- [${formatTaskStatus(idea.status ?? "captured")}] ${idea.title}`)
    .join("\n");

  const text = [
    `已处理：${noteLine}，${taskLine}，${ideaLine}，归入 ${input.projectName}。`,
    taskLines ? `\n任务：\n${taskLines}` : null,
    ideaLines ? `\n想法：\n${ideaLines}` : null,
    noteLines ? `\n笔记：\n${noteLines}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const objectButtons = [
    ...input.tasks.slice(0, 2).map((task) => ({
      label: `打开任务：${task.title}`,
      url: task.url ?? `${cleanAppUrl}/tasks/${task.id}`,
    })),
    ...input.notes
      .filter((note) => note.url)
      .slice(0, 2)
      .map((note) => ({
        label: `打开笔记：${note.title}`,
        url: note.url as string,
      })),
    ...input.ideas
      .filter((idea) => idea.url)
      .slice(0, 2)
      .map((idea) => ({
        label: `处理想法：${idea.title}`,
        url: idea.url as string,
      })),
  ].slice(0, 4);

  return {
    text,
    buttons: [
      ...objectButtons,
      { label: "打开今日任务", url: `${cleanAppUrl}/` },
      { label: "查看输入箱", url: `${cleanAppUrl}/inbox` },
    ],
  };
}

export async function createTelegramNotification<TDb extends NotificationDb>(
  db: TDb,
  input: TelegramNotificationInput,
) {
  const payload = buildTelegramPayload(input);
  const notificationDelegate = db.notification as {
    create(args: unknown): Promise<{ id: string; payload: unknown }>;
  };
  const activityLog = db.activityLog as {
    create(args: unknown): Promise<unknown>;
  };
  const notification = await notificationDelegate.create({
    data: {
      channel: "telegram",
      recipient: input.recipient,
      payload,
      relatedObjectType: input.relatedObjectType,
      relatedObjectId: input.relatedObjectId,
    },
  });

  await activityLog.create({
    data: {
      actorType: "system",
      action: "notification.created",
      targetType: "notification",
      targetId: notification.id,
      after: {
        channel: "telegram",
        recipient: input.recipient,
        text: payload.text,
      },
    },
  });

  return { notification, payload };
}
