import { TaskDetails } from "@/components/workspace/TaskDetails";
export const dynamic = "force-dynamic";
export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <div style={{ maxWidth: 980, margin: "0 auto" }}><p className="os-inline-note"><a href={`/tasks?task=${encodeURIComponent(id)}`}>← 返回任务看板</a></p><TaskDetails id={id} /></div>; }
