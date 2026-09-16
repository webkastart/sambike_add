CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED', 'PAUSED', 'ARCHIVED');
CREATE TYPE "CampaignExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED');
CREATE TYPE "CampaignAuditAction" AS ENUM ('CREATED', 'UPDATED', 'READY', 'PUBLISHED', 'PAUSED', 'ARCHIVED', 'SCHEDULED', 'DUPLICATED', 'VERSION_RESTORED', 'EXPERIMENT_CHANGED', 'META_CREATED', 'META_ACTIVATED', 'META_PAUSED', 'META_BUDGET_CHANGED', 'META_EMERGENCY_PAUSE');

ALTER TABLE "Campaign"
  ADD COLUMN "status" "CampaignStatus",
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "publishAt" TIMESTAMP(3),
  ADD COLUMN "unpublishAt" TIMESTAMP(3),
  ADD COLUMN "scheduleError" TEXT,
  ADD COLUMN "benefits" JSONB,
  ADD COLUMN "processSteps" JSONB,
  ADD COLUMN "faq" JSONB,
  ADD COLUMN "testimonials" JSONB,
  ADD COLUMN "openingHours" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "mapUrl" TEXT,
  ADD COLUMN "trustText" TEXT,
  ADD COLUMN "responseTimeText" TEXT,
  ADD COLUMN "finalCtaText" TEXT,
  ADD COLUMN "sectionOrder" JSONB,
  ADD COLUMN "seoTitle" TEXT,
  ADD COLUMN "seoDescription" TEXT,
  ADD COLUMN "canonicalUrl" TEXT,
  ADD COLUMN "ogTitle" TEXT,
  ADD COLUMN "ogDescription" TEXT,
  ADD COLUMN "ogImageUrl" TEXT,
  ADD COLUMN "noIndex" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "legalUrl" TEXT NOT NULL DEFAULT '/ochrana-osobnych-udajov';

UPDATE "Campaign"
SET "status" = CASE WHEN "isActive" THEN 'PUBLISHED'::"CampaignStatus" ELSE 'DRAFT'::"CampaignStatus" END,
    "publishedAt" = CASE WHEN "isActive" THEN COALESCE("updatedAt", "createdAt") ELSE NULL END;

ALTER TABLE "Campaign" ALTER COLUMN "status" SET NOT NULL;
DROP INDEX "Campaign_isActive_idx";
ALTER TABLE "Campaign" DROP COLUMN "isActive";
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");
CREATE INDEX "Campaign_status_publishAt_idx" ON "Campaign"("status", "publishAt");
CREATE INDEX "Campaign_status_unpublishAt_idx" ON "Campaign"("status", "unpublishAt");

CREATE TABLE "CampaignPublication" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "actor" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignPublication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CampaignPublication_campaignId_version_key" ON "CampaignPublication"("campaignId", "version");
CREATE INDEX "CampaignPublication_campaignId_publishedAt_idx" ON "CampaignPublication"("campaignId", "publishedAt");
ALTER TABLE "CampaignPublication" ADD CONSTRAINT "CampaignPublication_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CampaignAudit" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "action" "CampaignAuditAction" NOT NULL,
  "actor" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CampaignAudit_campaignId_createdAt_idx" ON "CampaignAudit"("campaignId", "createdAt");
ALTER TABLE "CampaignAudit" ADD CONSTRAINT "CampaignAudit_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CampaignExperiment" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "status" "CampaignExperimentStatus" NOT NULL DEFAULT 'DRAFT',
  "variantHeadline" TEXT,
  "variantDescription" TEXT,
  "variantCtaText" TEXT,
  "variantImageUrl" TEXT,
  "changedWhileRunning" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignExperiment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CampaignExperiment_campaignId_key" ON "CampaignExperiment"("campaignId");
CREATE INDEX "CampaignExperiment_status_idx" ON "CampaignExperiment"("status");
ALTER TABLE "CampaignExperiment" ADD CONSTRAINT "CampaignExperiment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD COLUMN "variant" TEXT;
ALTER TABLE "CampaignEvent" ADD COLUMN "variant" TEXT;

ALTER TABLE "MetaAdCampaign"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR',
  ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'sandbox',
  ADD COLUMN "lastPreviewAt" TIMESTAMP(3),
  ADD COLUMN "previewFacebookUrl" TEXT,
  ADD COLUMN "previewInstagramUrl" TEXT;

CREATE TABLE "MetaConnectionCheck" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "mode" TEXT NOT NULL,
  "adAccountId" TEXT NOT NULL,
  "currency" TEXT,
  "accountName" TEXT,
  "accountStatus" INTEGER,
  "timezoneName" TEXT,
  "spendCapCents" INTEGER,
  "amountSpentCents" INTEGER,
  "verifiedAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MetaConnectionCheck_pkey" PRIMARY KEY ("id")
);
