CREATE TABLE "DailyPlan" (
  "id" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "mainLine" TEXT NOT NULL,
  "firstAction" TEXT NOT NULL,
  "blocked" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "needsDecision" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourcePlannerPacket" JSONB NOT NULL,
  "deliveredTo" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DailyPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DailyPlan_date_mode_createdAt_idx"
  ON "DailyPlan"("date", "mode", "createdAt");
