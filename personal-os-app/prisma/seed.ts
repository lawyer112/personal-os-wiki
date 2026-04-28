import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.projectEvent.deleteMany();
  await prisma.projectNote.deleteMany();
  await prisma.note.deleteMany();
  await prisma.taskReview.deleteMany();
  await prisma.taskArtifact.deleteMany();
  await prisma.taskContribution.deleteMany();
  await prisma.taskClaim.deleteMany();
  await prisma.taskWikiLink.deleteMany();
  await prisma.idea.deleteMany();
  await prisma.task.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.inboxItem.deleteMany();
  await prisma.project.deleteMany();

  const project = await prisma.project.create({
    data: {
      name: "Acorn Launch Lab",
      goal: "Turn collected product ideas into small, reviewable launch experiments.",
      priority: "P1",
      currentFocus: "Validate the first demo workflow with fake data.",
    },
  });

  const inbox = await prisma.inboxItem.create({
    data: {
      sourceType: "manual",
      sourcePlatform: "demo",
      sourceMessageId: "demo-message-1",
      rawText:
        "Demo input: collect three customer notes, summarize the opportunity, and create one small next action.",
      status: "processed",
      createdBy: "user",
    },
  });

  const run = await prisma.agentRun.create({
    data: {
      inboxItemId: inbox.id,
      model: "demo-model",
      status: "completed",
      classification: { kind: "demo_workflow", confidence: 0.95 },
      reasoningSummary:
        "This fictional demo input contains one knowledge note, one task, and one idea.",
      outputSummary: "Created demo project context, task, idea, note, and activity.",
      completedAt: new Date(),
    },
  });

  const note = await prisma.note.create({
    data: {
      title: "Demo launch checklist",
      markdownPath: "demo/demo-launch-checklist.md",
      body: [
        "# Demo launch checklist",
        "",
        "This is invented sample content. Replace it with your own private notes.",
        "",
        "- Capture the source input.",
        "- Link the task to the relevant note.",
        "- Submit an artifact for review.",
      ].join("\n"),
      tags: ["demo", "launch", "workflow"],
      concepts: ["Task claiming", "Review gate", "Knowledge note"],
      sourceInboxItemId: inbox.id,
      sourceAgentRunId: run.id,
      projects: {
        create: {
          projectId: project.id,
        },
      },
    },
  });

  const task = await prisma.task.create({
    data: {
      title: "Review the fictional launch checklist",
      description:
        "Use this sample task to verify the task page, Wiki links, and agent context panel.",
      status: "todo",
      priority: "P1",
      riskLevel: "low",
      agentTags: ["demo", "review"],
      requiredOutput: "A short review comment and one linked artifact.",
      nextAction: "Open the task and confirm the linked demo note is visible.",
      definitionOfDone:
        "The task has a Wiki link, a contribution, and a review decision.",
      estimateMinutes: 15,
      projectId: project.id,
      sourceInboxItemId: inbox.id,
      sourceAgentRunId: run.id,
      createdBy: "system",
      wikiLinks: {
        create: {
          noteTitle: note.title,
          notePath: note.markdownPath,
          sourceType: "demo-seed",
          sourceInboxItemId: inbox.id,
          sourceAgentRunId: run.id,
        },
      },
    },
  });

  await prisma.idea.create({
    data: {
      title: "Add a demo screenshot after UI polish",
      body:
        "This fictional idea stays in the idea pool until the UI is ready for public screenshots.",
      status: "captured",
      priority: "P3",
      tags: ["demo", "docs"],
      nextAction: "Create a clean screenshot with fake data only.",
      projectId: project.id,
      sourceInboxItemId: inbox.id,
      sourceAgentRunId: run.id,
    },
  });

  const contribution = await prisma.taskContribution.create({
    data: {
      taskId: task.id,
      agentId: "demo-agent",
      summary: "Verified the fictional checklist and attached a placeholder artifact.",
      artifactUrls: ["https://example.com/demo-artifact"],
      evidenceLinks: ["wiki://demo/demo-launch-checklist.md"],
      nextRecommendation: "Approve the demo task or replace the fake data.",
    },
  });

  await prisma.taskArtifact.create({
    data: {
      taskId: task.id,
      contributionId: contribution.id,
      type: "link",
      title: "Demo artifact",
      url: "https://example.com/demo-artifact",
      verification: "demo-only",
    },
  });

  await prisma.projectEvent.create({
    data: {
      projectId: project.id,
      title: "Demo workflow initialized",
      body: "Fake seed data created a project, inbox item, note, task, contribution, and artifact.",
      eventType: "demo_seed",
      sourceInboxItemId: inbox.id,
      sourceAgentRunId: run.id,
    },
  });

  await prisma.activityLog.createMany({
    data: [
      {
        actorType: "system",
        action: "demo.seeded",
        targetType: "project",
        targetId: project.id,
        after: { project: project.name, taskId: task.id },
      },
      {
        actorType: "system",
        action: "task.contribution.created",
        targetType: "task",
        targetId: task.id,
        after: { contributionId: contribution.id },
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
