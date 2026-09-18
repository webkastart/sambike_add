ALTER TABLE "AppSetting"
  ADD COLUMN "metaPixelId" TEXT,
  ADD COLUMN "privacyOperatorName" TEXT,
  ADD COLUMN "privacyOperatorAddress" TEXT,
  ADD COLUMN "privacyContactEmail" TEXT,
  ADD COLUMN "privacyPolicyVersion" TEXT,
  ADD COLUMN "leadRetentionDays" INTEGER,
  ADD COLUMN "metaMaxCampaignDailyBudgetCents" INTEGER,
  ADD COLUMN "metaMaxGlobalDailyBudgetCents" INTEGER;

ALTER TABLE "MetaConnectionCheck"
  ADD COLUMN "pageAvailable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "instagramAvailable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "permissionsOk" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "datasetAssigned" BOOLEAN;

CREATE TABLE "OperationalSettingAudit" (
  "id" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "changedFields" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalSettingAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OperationalSettingAudit_createdAt_idx" ON "OperationalSettingAudit"("createdAt");

CREATE TABLE "CronHealth" (
  "id" TEXT NOT NULL,
  "lastAttemptAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "lastFailureAt" TIMESTAMP(3),
  "lastError" TEXT,
  "lastResult" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CronHealth_pkey" PRIMARY KEY ("id")
);
