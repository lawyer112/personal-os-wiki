import type { Prisma } from "@prisma/client";
import type { ActivityCreateInput } from "@/lib/validation";

type ActivityWritableDb = {
  activityLog: unknown;
};

export async function recordActivity<TDb extends ActivityWritableDb>(
  db: TDb,
  input: ActivityCreateInput,
) {
  const data = {
    ...input,
    before: input.before ?? undefined,
    after: input.after ?? undefined,
    undoPayload: input.undoPayload ?? undefined,
  } as Prisma.ActivityLogCreateInput;

  const activityLog = db.activityLog as {
    create(args: Prisma.ActivityLogCreateArgs): Promise<unknown>;
  };

  return activityLog.create({
    data,
  });
}
