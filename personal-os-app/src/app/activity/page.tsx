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
    <section className="grid gap-5">
      <div>
        <p className="ui-eyebrow">活动</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--ink)]">
          最近活动
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">
          这里只保留系统最近做过什么，作为回看和排查入口，不抢今日主线。
        </p>
      </div>
      <ActivityFeed items={items} />
    </section>
  );
}
