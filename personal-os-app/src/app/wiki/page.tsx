import { KnowledgeWorkspace } from "@/components/workspace/KnowledgeWorkspace";
import "@/components/workspace/knowledge.css";
export const dynamic = "force-dynamic";
export default async function WikiPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const initial = Object.fromEntries(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  return <KnowledgeWorkspace initial={initial} />;
}
