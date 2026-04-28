import { recordActivity } from "@/lib/activity";
import type {
  ProjectCreateInput,
  ProjectEventCreateInput,
} from "@/lib/validation";

type ProjectDb = {
  project: unknown;
  projectEvent: unknown;
  activityLog: unknown;
};

export async function createProject<TDb extends ProjectDb>(
  db: TDb,
  input: ProjectCreateInput,
) {
  const projectDelegate = db.project as {
    create(args: unknown): Promise<{ id: string; name: string }>;
  };
  const project = await projectDelegate.create({ data: input });
  await recordActivity(db, {
    actorType: "hermes",
    action: "project.created",
    targetType: "project",
    targetId: project.id,
    after: { name: project.name },
  });
  return project;
}

export async function createProjectEvent<TDb extends ProjectDb>(
  db: TDb,
  projectId: string,
  input: ProjectEventCreateInput,
) {
  const projectEvent = db.projectEvent as {
    create(args: unknown): Promise<{ id: string; title: string }>;
  };
  const event = await projectEvent.create({
    data: {
      ...input,
      projectId,
    },
  });

  await recordActivity(db, {
    actorType: "hermes",
    action: "project.event.created",
    targetType: "project",
    targetId: projectId,
    after: { eventId: event.id, title: event.title },
  });

  return event;
}
