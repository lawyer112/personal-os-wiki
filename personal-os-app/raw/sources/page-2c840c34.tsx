import { TodayWorkspace } from "@/components/TodayWorkspace";
import { prisma } from "@/lib/db";
import { getToday } from "@/lib/today";
import type { TodayView } from "@/lib/view-models";

export const dynamic = "force-dynamic";

export default async function Home() {
  const today = (await getToday(prisma)) as TodayView;
  return <TodayWorkspace today={today} />;
}
