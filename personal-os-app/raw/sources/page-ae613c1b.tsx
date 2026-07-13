import { ActivityFeed } from "@/components/ActivityFeed";
import { prisma } from "@/lib/db";
import type { ActivityItem } from "@/lib/view-models";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const items = (await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  })) as ActivityItem[];

  return (
    <section>
      <h1 className="mb-5 text-3xl font-bold tracking-tight">Activity Log</h1>
      <ActivityFeed items={items} />
    </section>
  );
}
