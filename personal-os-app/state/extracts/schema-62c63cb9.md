generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

enum InboxStatus {
  new
  processing
  processed
  failed
  archived
}

enum AgentRunStatus {
  running
  completed
  failed
}

enum ProjectStatus {
  active
  waiting
  blocked
  paused
  done
  archived
}

enum TaskStatus {
  review
  todo
  doing
  waiting
  blocked
  done
  archived
}

enum Priority {
  P0
  P1
  P2
  P3
}

enum TaskRiskLevel {
  low
  medium
  high
}

enum TaskExecutionMode {
  manual
  agent_suggested
  agent_allowed
  approval_required
  blocked_until_user
}

enum ActorType {
  user
  hermes
  codex
  system
}

enum NotificationChannel {
  telegram
  web
}

enum NotificationStatus {
  pending
  sent
  failed
}

enum IdeaStatus {
  captured
  shaping
  someday
  promoted
  archived
}

enum WikiWriteJobStatus {
  queued
  processing
  done
  retry
  failed
  cancelled
}

model InboxItem {
  id              String         @id @default(cuid())
  sourceType      String
  sourcePlatform  String
  sourceMessageId String?
  rawText         String
  sourceUrl       String?
  attachments     Json?
  status          InboxStatus    @default(new)
  createdBy       String         @default("hermes")
  receivedAt      DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  agentRuns       AgentRun[]
  tasks           Task[]
  notes           Note[]
  projectEvents   ProjectEvent[]
  ideas           Idea[]
  wikiWriteJobs   WikiWriteJob[]

  @@index([status, receivedAt])
  @@index([sourcePlatform, sourceMessageId])
}

model AgentRun {
  id               String         @id @default(cuid())
  inboxItemId      String
  inboxItem        InboxItem      @relation(fields: [inboxItemId], references: [id], onDelete: Cascade)
  model            String
  status           AgentRunStatus @default(running)
  classification   Json?
  reasoningSummary String?
  outputSummary    String?
  error            String?
  startedAt        DateTime       @default(now())
  completedAt      DateTime?
  tasks            Task[]
  notes            Note[]
  projectEvents    ProjectEvent[]
  ideas            Idea[]
  wikiWriteJobs    WikiWriteJob[]

  @@index([inboxItemId])
  @@index([status, startedAt])
}

model Project {
  id           String         @id @default(cuid())
  name         String         @unique
  goal         String?
  status       ProjectStatus  @default(active)
  priority     Priority       @default(P2)
  currentFocus String?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  tasks        Task[]
  notes        ProjectNote[]
  events       ProjectEvent[]
  ideas        Idea[]
  wikiWriteJobs WikiWriteJob[]

  @@index([status, priority])
}

model Task {
  id                String         @id @default(cuid())
  title             String
  description       String?
  status            TaskStatus     @default(review)
  priority          Priority       @default(P2)
  riskLevel         TaskRiskLevel   @default(low)
  executionMode     TaskExecutionMode @default(manual)
  agentTags         String[]        @default([])
  ownerAgent        String?
  leaseUntil        DateTime?
  lastHeartbeatAt   DateTime?
  requiredOutput    String?
  nextAction        String
  definitionOfDone  String
  dueDate           DateTime?
  estimateMinutes   Int?
  createdBy         String         @default("hermes")
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  completedAt       DateTime?
  submittedAt       DateTime?
  projectId         String?
  project           Project?       @relation(fields: [projectId], references: [id], onDelete: SetNull)
  sourceInboxItemId String?
  sourceInboxItem   InboxItem?     @relation(fields: [sourceInboxItemId], references: [id], onDelete: SetNull)
  sourceAgentRunId  String?
  sourceAgentRun    AgentRun?      @relation(fields: [sourceAgentRunId], references: [id], onDelete: SetNull)
  wikiLinks         TaskWikiLink[]
  claims            TaskClaim[]
  contributions     TaskContribution[]
  artifacts         TaskArtifact[]
  reviews           TaskReview[]
  promotedIdeas     Idea[]         @relation("IdeaPromotedTask")

  @@index([status, priority, dueDate])
  @@index([projectId])
  @@index([ownerAgent, leaseUntil])
  @@index([executionMode, riskLevel])
}

model AgentProfile {
  id                   String         @id
  displayName          String
  tags                 String[]       @default([])
  capabilities         String[]       @default([])
  allowedRiskLevel     TaskRiskLevel  @default(low)
  canWriteWiki         Boolean        @default(false)
  canWriteTasks        Boolean        @default(true)
  canTouchFiles        Boolean        @default(false)
  canSendNotifications Boolean        @default(false)
  enabled              Boolean        @default(true)
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt

  @@index([enabled])
}

model TaskWikiLink {
  id                String   @id @default(cuid())
  taskId            String
  task              Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  noteTitle         String
  notePath          String?
  noteUrl           String?
  sourceType        String?
  sourceInboxItemId String?
  sourceAgentRunId  String?
  createdAt         DateTime @default(now())

  @@index([taskId])
  @@index([notePath])
}

model WikiWriteJob {
  id                String             @id @default(cuid())
  idempotencyKey    String             @unique
  title             String
  payload           Json
  status            WikiWriteJobStatus @default(queued)
  attempts          Int                @default(0)
  maxAttempts       Int                @default(5)
  lastError         String?
  nextRunAt         DateTime           @default(now())
  lockedBy          String?
  lockedAt          DateTime?
  completedAt       DateTime?
  notePath          String?
  noteUrl           String?
  sourceInboxItemId String?
  sourceInboxItem   InboxItem?         @relation(fields: [sourceInboxItemId], references: [id], onDelete: SetNull)
  sourceAgentRunId  String?
  sourceAgentRun    AgentRun?          @relation(fields: [sourceAgentRunId], references: [id], onDelete: SetNull)
  projectId         String?
  project           Project?           @relation(fields: [projectId], references: [id], onDelete: SetNull)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  @@index([status, nextRunAt, createdAt])
  @@index([sourceInboxItemId])
  @@index([sourceAgentRunId])
  @@index([projectId])
}

model TaskClaim {
  id            String    @id @default(cuid())
  taskId        String
  task          Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  agentId       String
  claimedAt     DateTime  @default(now())
  leaseUntil    DateTime
  releasedAt    DateTime?
  releaseReason String?

  @@index([taskId, claimedAt])
  @@index([agentId, leaseUntil])
}

model TaskContribution {
  id                 String         @id @default(cuid())
  taskId             String
  task               Task           @relation(fields: [taskId], references: [id], onDelete: Cascade)
  agentId            String
  summary            String
  evidenceLinks      String[]       @default([])
  artifactUrls       String[]       @default([])
  nextRecommendation String?
  createdAt          DateTime       @default(now())
  artifacts          TaskArtifact[]

  @@index([taskId, createdAt])
  @@index([agentId, createdAt])
}

model TaskArtifact {
  id             String            @id @default(cuid())
  taskId         String
  task           Task              @relation(fields: [taskId], references: [id], onDelete: Cascade)
  contributionId String?
  contribution   TaskContribution? @relation(fields: [contributionId], references: [id], onDelete: SetNull)
  type           String            @default("link")
  title          String?
  url            String
  verification   String            @default("unverified")
  createdAt      DateTime          @default(now())

  @@index([taskId, createdAt])
  @@index([contributionId])
}

model TaskReview {
  id        String   @id @default(cuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  reviewer  String
  decision  String
  comment   String?
  createdAt DateTime @default(now())

  @@index([taskId, createdAt])
  @@index([reviewer, createdAt])
}

model Idea {
  id                String     @id @default(cuid())
  title             String
  body              String
  status            IdeaStatus @default(captured)
  priority          Priority   @default(P2)
  tags              String[]   @default([])
  nextAction        String?
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  projectId         String?
  project           Project?   @relation(fields: [projectId], references: [id], onDelete: SetNull)
  sourceInboxItemId String?
  sourceInboxItem   InboxItem? @relation(fields: [sourceInboxItemId], references: [id], onDelete: SetNull)
  sourceAgentRunId  String?
  sourceAgentRun    AgentRun?  @relation(fields: [sourceAgentRunId], references: [id], onDelete: SetNull)
  promotedTaskId    String?
  promotedTask      Task?      @relation("IdeaPromotedTask", fields: [promotedTaskId], references: [id], onDelete: SetNull)

  @@index([status, priority, updatedAt])
  @@index([projectId])
  @@index([promotedTaskId])
}

model Note {
  id                String        @id @default(cuid())
  title             String
  markdownPath      String        @unique
  body              String
  tags              String[]      @default([])
  concepts          String[]      @default([])
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  sourceInboxItemId String?
  sourceInboxItem   InboxItem?    @relation(fields: [sourceInboxItemId], references: [id], onDelete: SetNull)
  sourceAgentRunId  String?
  sourceAgentRun    AgentRun?     @relation(fields: [sourceAgentRunId], references: [id], onDelete: SetNull)
  projects          ProjectNote[]

  @@index([createdAt])
}

model ProjectNote {
  projectId String
  noteId    String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  note      Note    @relation(fields: [noteId], references: [id], onDelete: Cascade)

  @@id([projectId, noteId])
}

model ProjectEvent {
  id                String     @id @default(cuid())
  projectId         String
  project           Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title             String
  body              String
  eventType         String
  createdAt         DateTime   @default(now())
  sourceInboxItemId String?
  sourceInboxItem   InboxItem? @relation(fields: [sourceInboxItemId], references: [id], onDelete: SetNull)
  sourceAgentRunId  String?
  sourceAgentRun    AgentRun?  @relation(fields: [sourceAgentRunId], references: [id], onDelete: SetNull)

  @@index([projectId, createdAt])
}

model ActivityLog {
  id          String    @id @default(cuid())
  actorType   ActorType
  actorId     String?
  action      String
  targetType  String
  targetId    String
  before      Json?
  after       Json?
  undoPayload Json?
  createdAt   DateTime  @default(now())

  @@index([targetType, targetId, createdAt])
  @@index([actorType, createdAt])
}

model Notification {
  id                String              @id @default(cuid())
  channel           NotificationChannel
  recipient         String
  payload           Json
  status            NotificationStatus  @default(pending)
  sentAt            DateTime?
  relatedObjectType String?
  relatedObjectId   String?
  createdAt         DateTime            @default(now())

  @@index([channel, status, createdAt])
}

model DailyPlan {
  id                  String   @id @default(cuid())
  date                String
  timezone            String   @default("UTC")
  mode                String
  mainLine            String
  firstAction         String
  blocked             String[] @default([])
  needsDecision       String[] @default([])
  sourcePlannerPacket Json
  deliveredTo         String[] @default([])
  createdAt           DateTime @default(now())

  @@index([date, mode, createdAt])
}

/// Local vector memory store for hybrid episode recall PoC.
/// Each row holds a text chunk and its embedding (Float[]) for cosine-similarity search.
model MemoryItem {
  id            String   @id @default(cuid())
  /// Source type: task | activity | agent_run | wiki | inbox
  sourceType    String
  /// Source record id for provenance
  sourceId      String
  /// Human-readable title for display in context
  title         String
  /// Short summary / body used for retrieval
  body          String
  /// Optional project scope
  projectId     String?
  /// Embedding vector (dimension matches EMBEDDING_MODEL)
  embedding     Float[]
  /// Expire items after this date so stale vectors are skipped
  expiresAt     DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([sourceType, sourceId])
  @@index([projectId, createdAt])
  @@index([expiresAt])
}
