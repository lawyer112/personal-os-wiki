import { prisma } from "@/lib/db";
import { handleRouteError, json, requireReadAccess } from "@/lib/http";
import type { WikiWriteJobDb, WikiWriteJobStatus } from "@/lib/wiki-write-jobs";

export const dynamic = "force-dynamic";

const allowedStatuses = new Set<WikiWriteJobStatus>([
  "queued",
  "processing",
  "done",
  "retry",
  "failed",
  "cancelled",
]);

type WikiWriteJobReadDb = WikiWriteJobDb & {
  wikiWriteJob: {
    findMany(args: unknown): Promise<unknown[]>;
    count(args: unknown): Promise<number>;
  };
};

export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const url = new URL(request.url);
    const statuses = parseStatuses(url.searchParams);
    const limit = parseLimit(url.searchParams.get("limit"));
    const where =
      statuses.length > 0
        ? {
            status: { in: statuses },
          }
        : {};
    const db = prisma as unknown as WikiWriteJobReadDb;
    const [jobs, count] = await Promise.all([
      db.wikiWriteJob.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          attempts: true,
          maxAttempts: true,
          lastError: true,
          nextRunAt: true,
          lockedBy: true,
          lockedAt: true,
          completedAt: true,
          notePath: true,
          noteUrl: true,
          sourceInboxItemId: true,
          sourceAgentRunId: true,
          projectId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.wikiWriteJob.count({ where }),
    ]);

    return json({ ok: true, count, limit, jobs });
  } catch (error) {
    return handleRouteError(error);
  }
}

const parseStatuses = (params: URLSearchParams) =>
  params
    .getAll("status")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value): value is WikiWriteJobStatus =>
      allowedStatuses.has(value as WikiWriteJobStatus),
    );

const parseLimit = (raw: string | null) => {
  const value = Number(raw ?? "50");
  if (!Number.isInteger(value) || value < 1) {
    return 50;
  }
  return Math.min(value, 200);
};
