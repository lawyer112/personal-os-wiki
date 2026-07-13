import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { recordActivity } from "@/lib/activity";
import { markdownPathForTitle, vaultDir } from "@/lib/paths";
import type { NoteCreateInput } from "@/lib/validation";

type NoteDb = {
  note: unknown;
  activityLog: unknown;
};

function yamlList(values: string[]) {
  if (values.length === 0) {
    return "[]";
  }

  return values.map((value) => `\n  - ${JSON.stringify(value)}`).join("");
}

export function renderMarkdownNote(input: NoteCreateInput) {
  return [
    "---",
    `title: ${JSON.stringify(input.title)}`,
    `tags:${yamlList(input.tags)}`,
    `concepts:${yamlList(input.concepts)}`,
    input.sourceInboxItemId
      ? `source_inbox_item_id: ${JSON.stringify(input.sourceInboxItemId)}`
      : null,
    input.sourceAgentRunId
      ? `source_agent_run_id: ${JSON.stringify(input.sourceAgentRunId)}`
      : null,
    "---",
    "",
    input.body.trim(),
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export async function writeMarkdownNote(input: NoteCreateInput) {
  const relativePath = markdownPathForTitle(input.title);
  const absolutePath = path.join(vaultDir(), relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, renderMarkdownNote(input), "utf8");
  return relativePath.replaceAll(path.sep, "/");
}

export async function createNote<TDb extends NoteDb>(
  db: TDb,
  input: NoteCreateInput,
) {
  const noteDelegate = db.note as {
    create(args: unknown): Promise<{ id: string; title: string; markdownPath: string }>;
  };
  const markdownPath = await writeMarkdownNote(input);
  const note = await noteDelegate.create({
    data: {
      title: input.title,
      body: input.body,
      tags: input.tags,
      concepts: input.concepts,
      markdownPath,
      sourceInboxItemId: input.sourceInboxItemId,
      sourceAgentRunId: input.sourceAgentRunId,
      projects: {
        create: input.projectIds.map((projectId) => ({ projectId })),
      },
    },
  });

  await recordActivity(db, {
    actorType: "hermes",
    action: "note.created",
    targetType: "note",
    targetId: note.id,
    after: {
      title: note.title,
      markdownPath: note.markdownPath,
      projectIds: input.projectIds,
    },
  });

  return note;
}
