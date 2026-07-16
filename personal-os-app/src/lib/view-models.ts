export type RelatedProject = {
  id: string;
  name: string;
  status?: string;
  currentFocus?: string | null;
};

export type RelatedInboxItem = {
  rawText: string;
  sourceType?: string;
  sourcePlatform?: string;
};

export type RelatedAgentRun = {
  reasoningSummary?: string | null;
  outputSummary?: string | null;
  model?: string;
};

export type TaskView = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  riskLevel?: string;
  executionMode?: string;
  ownerAgent?: string | null;
  leaseUntil?: Date | string | null;
  lastHeartbeatAt?: Date | string | null;
  nextAction: string;
  definitionOfDone: string;
  estimateMinutes?: number | null;
  dueDate?: Date | string | null;
  completedAt?: Date | string | null;
  submittedAt?: Date | string | null;
  project?: RelatedProject | null;
  sourceInboxItem?: RelatedInboxItem | null;
  sourceAgentRun?: RelatedAgentRun | null;
  wikiLinks?: Array<{
    id: string;
    noteTitle: string;
    notePath?: string | null;
    noteUrl?: string | null;
    sourceType?: string | null;
  }>;
  claims?: Array<{
    id: string;
    agentId: string;
    claimedAt?: Date | string;
    leaseUntil?: Date | string;
    releasedAt?: Date | string | null;
    releaseReason?: string | null;
  }>;
  contributions?: Array<{
    id: string;
    taskRunId?: string | null;
    agentId: string;
    summary: string;
    evidenceLinks?: string[];
    artifactUrls?: string[];
    nextRecommendation?: string | null;
    createdAt?: Date | string;
  }>;
  artifacts?: Array<{
    id: string;
    type: string;
    title?: string | null;
    url: string;
    verification?: string;
    createdAt?: Date | string;
  }>;
  reviews?: Array<{
    id: string;
    reviewer: string;
    decision: string;
    comment?: string | null;
    createdAt?: Date | string;
  }>;
  runs?: Array<{
    id: string;
    agentId: string;
    status: string;
    resultSummary?: string | null;
    startedAt?: Date | string;
    lastHeartbeatAt?: Date | string | null;
    submittedAt?: Date | string | null;
    endedAt?: Date | string | null;
  }>;
  agentActionLogs?: Array<{
    id: string;
    taskRunId?: string | null;
    agentId: string;
    action: string;
    summary?: string | null;
    metadata?: unknown;
    createdAt?: Date | string;
  }>;
};

export type IdeaView = {
  id: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  tags: string[];
  nextAction?: string | null;
  promotedTaskId?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  project?: RelatedProject | null;
  sourceInboxItem?: RelatedInboxItem | null;
  sourceAgentRun?: RelatedAgentRun | null;
  promotedTask?: {
    id: string;
    title: string;
    status: string;
  } | null;
};

export type ProjectRadarItem = RelatedProject & {
  priority?: string;
  goal?: string | null;
  tasks?: TaskView[];
};

export type ActivityItem = {
  id: string;
  actorType: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt?: Date | string;
};

export type TodayView = {
  metrics: {
    now: number;
    review: number;
    intakeReview: number;
    executionReview: number;
    waiting: number;
    blocked: number;
    done: number;
  };
  nowTasks: TaskView[];
  reviewTasks: TaskView[];
  executionReviewTasks: TaskView[];
  waitingTasks: TaskView[];
  blockedTasks: TaskView[];
  doneTasks: TaskView[];
  projects: ProjectRadarItem[];
  activity: ActivityItem[];
};
