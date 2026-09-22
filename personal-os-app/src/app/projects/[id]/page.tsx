import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
/** 旧项目链接保留可访问性，统一进入带项目筛选的任务中心。 */
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/tasks?project=${encodeURIComponent(id)}`);
}
