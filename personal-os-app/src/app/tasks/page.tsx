import { TaskWorkspace } from "@/components/workspace/TaskWorkspace";
import type { TaskWorkspaceInitial } from "@/components/workspace/TaskWorkspace";
export const dynamic = "force-dynamic";
export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const initial = Object.fromEntries(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string")) as TaskWorkspaceInitial;
  return <TaskWorkspace initial={initial} />;
}
