import { z } from "zod";

const jsonRecord = z.record(z.string(), z.unknown());
const optionalJsonRecord = jsonRecord.optional();
const optionalFormString = (max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().min(1).max(max).optional(),
  );

export const taskStatuses = [
  "review",
  "todo",
  "doing",
  "waiting",
  "blocked",
  "done",
  "archived",
] as const;

export const priorities = ["P0", "P1", "P2", "P3"] as const;
export const taskRiskLevels = ["low", "medium", "high"] as const;
export const taskExecutionModes = [
  "manual",
  "agent_suggested",
  "agent_allowed",
  "approval_required",
  "blocked_until_user",
] as const;
export const ideaStatuses = [
  "captured",
  "shaping",
  "someday",
  "promoted",
  "archived",
] as const;

export const wikiLinkSchema = z.object({
  noteTitle: z.string().min(1),
  notePath: z.string().min(1).optional(),
  noteUrl: z.url().optional(),
  sourceType: z.string().min(1).optional(),
  sourceInboxItemId: z.string().min(1).optional(),
  sourceAgentRunId: z.string().min(1).optional(),
});

export const inboxCreateSchema = z.object({
  sourceType: z.string().min(1),
  sourcePlatform: z.string().min(1).default("telegram"),
  sourceMessageId: z.string().min(1).optional(),
  rawText: z.string().min(1),
  sourceUrl: z.url().optional(),
  attachments: z.array(jsonRecord).default([]),
  createdBy: z.string().min(1).default("hermes"),
});

export const captureCreateSchema = z
  .object({
    content: optionalFormString(12000),
    sourcePlatform: z.string().min(1).default("web"),
    createdBy: z.string().min(1).default("user"),
  })
  .refine(
    (input) => Boolean(input.content),
    {
      message: "Capture needs a link or text.",
      path: ["content"],
    },
  );

export const agentRunCreateSchema = z.object({
  inboxItemId: z.string().min(1),
  model: z.string().min(1),
  classification: optionalJsonRecord,
  reasoningSummary: z.string().optional(),
});

export const agentRunCompleteSchema = z.object({
  classification: optionalJsonRecord,
  reasoningSummary: z.string().optional(),
  outputSummary: z.string().optional(),
  error: z.string().optional(),
});

export const projectCreateSchema = z.object({
  name: z.string().min(1),
  goal: z.string().optional(),
  status: z
    .enum(["active", "waiting", "blocked", "paused", "done", "archived"])
    .default("active"),
  priority: z.enum(priorities).default("P2"),
  currentFocus: z.string().optional(),
});

export const taskCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(taskStatuses).default("review"),
  priority: z.enum(priorities).default("P2"),
  riskLevel: z.enum(taskRiskLevels).default("low"),
  executionMode: z.enum(taskExecutionModes).default("manual"),
  agentTags: z.array(z.string().min(1)).default([]),
  requiredOutput: z.string().optional(),
  nextAction: z.string().min(1),
  definitionOfDone: z.string().min(1),
  dueDate: z.coerce.date().optional(),
  estimateMinutes: z.number().int().positive().optional(),
  projectId: z.string().min(1).optional(),
  sourceInboxItemId: z.string().min(1).optional(),
  sourceAgentRunId: z.string().min(1).optional(),
  createdBy: z.string().min(1).default("hermes"),
  wikiLinks: z.array(wikiLinkSchema).default([]),
});

export const taskUpdateSchema = taskCreateSchema.partial().extend({
  status: z.enum(taskStatuses).optional(),
});

export const agentInboxQuerySchema = z.object({
  agentId: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export const taskClaimSchema = z.object({
  agentId: z.string().min(1),
  leaseMinutes: z.number().int().positive().max(24 * 60).default(90),
});

export const taskHeartbeatSchema = z.object({
  agentId: z.string().min(1),
  leaseMinutes: z.number().int().positive().max(24 * 60).default(90),
});

export const taskContributionSchema = z.object({
  agentId: z.string().min(1),
  summary: z.string().min(1),
  evidenceLinks: z.array(z.string().min(1)).default([]),
  artifactUrls: z.array(z.string().min(1)).default([]),
  nextRecommendation: z.string().optional(),
});

export const taskSubmitSchema = taskContributionSchema.extend({
  resultType: z.string().min(1).default("artifact"),
  definitionOfDoneMet: z.boolean().default(false),
  needsHumanDecision: z.boolean().default(true),
});

export const taskReviewSchema = z.object({
  reviewer: z.string().min(1).default("user"),
  decision: z.enum(["approve", "request_changes", "reject", "block", "archive"]),
  comment: z.string().optional(),
});

export const agentProfileCreateSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  capabilities: z.array(z.string().min(1)).default([]),
  allowedRiskLevel: z.enum(taskRiskLevels).default("low"),
  canWriteWiki: z.boolean().default(false),
  canWriteTasks: z.boolean().default(true),
  canTouchFiles: z.boolean().default(false),
  canSendNotifications: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export const agentProfileUpdateSchema = agentProfileCreateSchema.partial().omit({
  id: true,
});

export const noteCreateSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  concepts: z.array(z.string().min(1)).default([]),
  projectIds: z.array(z.string().min(1)).default([]),
  sourceInboxItemId: z.string().min(1).optional(),
  sourceAgentRunId: z.string().min(1).optional(),
});

export const ideaCreateSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  status: z.enum(ideaStatuses).default("captured"),
  priority: z.enum(priorities).default("P2"),
  tags: z.array(z.string().min(1)).default([]),
  nextAction: z.string().optional(),
  projectId: z.string().min(1).optional(),
  sourceInboxItemId: z.string().min(1).optional(),
  sourceAgentRunId: z.string().min(1).optional(),
});

export const ideaUpdateSchema = ideaCreateSchema.partial().extend({
  status: z.enum(ideaStatuses).optional(),
  promotedTaskId: z.string().min(1).optional(),
});

export const ideaPromoteSchema = z.object({
  title: z.string().min(1).optional(),
  priority: z.enum(priorities).optional(),
  nextAction: z.string().min(1).optional(),
  definitionOfDone: z.string().min(1).optional(),
});

export const projectEventCreateSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  eventType: z.string().min(1).default("update"),
  sourceInboxItemId: z.string().min(1).optional(),
  sourceAgentRunId: z.string().min(1).optional(),
});

export const activityCreateSchema = z.object({
  actorType: z.enum(["user", "hermes", "codex", "system"]),
  actorId: z.string().optional(),
  action: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  before: jsonRecord.nullable().optional(),
  after: jsonRecord.nullable().optional(),
  undoPayload: jsonRecord.nullable().optional(),
});

export const telegramNotificationSchema = z.object({
  recipient: z.string().min(1),
  projectName: z.string().min(1).default("Personal OS"),
  notes: z
    .array(z.object({ id: z.string(), title: z.string(), url: z.string().optional() }))
    .default([]),
  tasks: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        status: z.string().optional(),
        url: z.string().optional(),
      }),
    )
    .default([]),
  ideas: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        status: z.string().optional(),
        url: z.string().optional(),
      }),
    )
    .default([]),
  appUrl: z.string().optional(),
  relatedObjectType: z.string().optional(),
  relatedObjectId: z.string().optional(),
});

export const dailyPlanSnapshotSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  timezone: z.string().min(1).optional(),
  mode: z.enum(["morning", "checkin", "evening"]).default("morning"),
  appUrl: z.string().optional(),
  mainLine: z.string().min(1),
  firstAction: z.string().min(1),
  blocked: z.array(z.string().min(1)).default([]),
  needsDecision: z.array(z.string().min(1)).default([]),
  deliveredTo: z.array(z.string().min(1)).default([]),
  sourcePlannerPacket: jsonRecord.optional(),
});

const wikiFrontmatterSchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1),
  created_by: z.string().min(1),
  source_type: z.string().min(1),
  tags: z.array(z.string().min(1)),
  created_at: z.string().min(1).optional(),
  task_id: z.string().min(1).optional(),
  agent_id: z.string().min(1).optional(),
  project: z.string().min(1).optional(),
  last_reviewed: z.string().min(1).optional(),
  migration: z.string().min(1).optional(),
  source_url: z.string().optional(),
  canonical_url: z.string().optional(),
  source_hash: z.string().min(1).optional(),
  text_hash: z.string().min(1).optional(),
  source_domain: z.string().optional(),
  tweet_id: z.string().min(1).optional(),
  tweet_thread_id: z.string().optional(),
  author_handle: z.string().optional(),
  author_name: z.string().optional(),
  collected_at: z.string().min(1).optional(),
  summary: z.string().optional(),
  risk_level: z.string().optional(),
  external_urls: z.array(z.string()).optional(),
  media: z.array(jsonRecord).optional(),
  personal_os_inbox_id: z.string().min(1).optional(),
  personal_os_agent_run_id: z.string().min(1).optional(),
  personal_os_project_id: z.string().min(1).optional(),
  personal_os_task_id: z.string().min(1).optional(),
});

export const wikiIngestSchema = z
  .object({
    frontmatter: wikiFrontmatterSchema.optional(),
    title: z.string().min(1).optional(),
    content: z.string().min(1),
    source_type: z.string().min(1).optional(),
    source_url: z.string().optional(),
    tags: z.array(z.string().min(1)).optional(),
    metadata: jsonRecord.default({}),
  })
  .refine((input) => Boolean(input.frontmatter) || Boolean(input.title), {
    message: "Wiki ingest needs frontmatter or a legacy title.",
    path: ["frontmatter"],
  });

export const intakeSchema = z.object({
  source: inboxCreateSchema,
  agent: z.object({
    model: z.string().min(1).default("example-agent-model"),
    classification: optionalJsonRecord,
    reasoningSummary: z.string().optional(),
    outputSummary: z.string().optional(),
  }).default({ model: "example-agent-model" }),
  project: projectCreateSchema.partial().extend({
    id: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
  }).optional(),
  wikiNotes: z.array(wikiIngestSchema).default([]),
  tasks: z.array(taskCreateSchema.omit({
    sourceInboxItemId: true,
    sourceAgentRunId: true,
    createdBy: true,
  }).extend({
    sourceInboxItemId: z.string().min(1).optional(),
    sourceAgentRunId: z.string().min(1).optional(),
    createdBy: z.string().min(1).default("hermes"),
  })).default([]),
  ideas: z.array(ideaCreateSchema.omit({
    sourceInboxItemId: true,
    sourceAgentRunId: true,
  }).extend({
    sourceInboxItemId: z.string().min(1).optional(),
    sourceAgentRunId: z.string().min(1).optional(),
  })).default([]),
  projectEvents: z.array(projectEventCreateSchema.extend({
    projectId: z.string().min(1).optional(),
    projectName: z.string().min(1).optional(),
  })).default([]),
  notes: z.array(noteCreateSchema.omit({
    sourceInboxItemId: true,
    sourceAgentRunId: true,
  }).extend({
    sourceInboxItemId: z.string().min(1).optional(),
    sourceAgentRunId: z.string().min(1).optional(),
  })).default([]),
  notification: z.object({
    recipient: z.string().min(1),
    projectName: z.string().min(1).optional(),
  }).optional(),
});

export type InboxCreateInput = z.infer<typeof inboxCreateSchema>;
export type CaptureCreateInput = z.infer<typeof captureCreateSchema>;
export type AgentRunCreateInput = z.infer<typeof agentRunCreateSchema>;
export type AgentRunCompleteInput = z.infer<typeof agentRunCompleteSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type AgentInboxQueryInput = z.infer<typeof agentInboxQuerySchema>;
export type TaskClaimInput = z.infer<typeof taskClaimSchema>;
export type TaskHeartbeatInput = z.infer<typeof taskHeartbeatSchema>;
export type TaskContributionInput = z.infer<typeof taskContributionSchema>;
export type TaskSubmitInput = z.infer<typeof taskSubmitSchema>;
export type TaskReviewInput = z.infer<typeof taskReviewSchema>;
export type AgentProfileCreateInput = z.infer<typeof agentProfileCreateSchema>;
export type AgentProfileUpdateInput = z.infer<typeof agentProfileUpdateSchema>;
export type NoteCreateInput = z.infer<typeof noteCreateSchema>;
export type IdeaCreateInput = z.infer<typeof ideaCreateSchema>;
export type IdeaUpdateInput = z.infer<typeof ideaUpdateSchema>;
export type IdeaPromoteInput = z.infer<typeof ideaPromoteSchema>;
export type ProjectEventCreateInput = z.infer<typeof projectEventCreateSchema>;
export type ActivityCreateInput = z.infer<typeof activityCreateSchema>;
export type WikiIngestInput = z.infer<typeof wikiIngestSchema>;
export type IntakeInput = z.infer<typeof intakeSchema>;
export type TelegramNotificationInput = z.infer<
  typeof telegramNotificationSchema
>;
export type DailyPlanSnapshotInput = z.infer<typeof dailyPlanSnapshotSchema>;
