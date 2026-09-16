CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'BOOKED', 'COMPLETED', 'LOST', 'SPAM');
CREATE TYPE "LeadActivityType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'NOTE_ADDED', 'FOLLOW_UP_CHANGED', 'ASSIGNEE_CHANGED', 'VALUE_CHANGED', 'NOTIFICATION_SENT', 'NOTIFICATION_RETRIED', 'ANONYMIZED');
CREATE TYPE "CampaignEventType" AS ENUM ('PAGE_VIEW', 'CTA_CLICK', 'PHONE_CLICK', 'FORM_START', 'LEAD_CREATED');

ALTER TABLE "Lead"
  ADD COLUMN "normalizedPhone" TEXT,
  ADD COLUMN "normalizedEmail" TEXT,
  ADD COLUMN "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "assignedTo" TEXT,
  ADD COLUMN "nextFollowUpAt" TIMESTAMP(3),
  ADD COLUMN "lostReason" TEXT,
  ADD COLUMN "completedValueCents" INTEGER,
  ADD COLUMN "completedValueCurrency" TEXT,
  ADD COLUMN "firstContactedAt" TIMESTAMP(3),
  ADD COLUMN "bookedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "possibleDuplicate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "firstUtmSource" TEXT,
  ADD COLUMN "firstUtmMedium" TEXT,
  ADD COLUMN "firstUtmCampaign" TEXT,
  ADD COLUMN "firstUtmContent" TEXT,
  ADD COLUMN "firstUtmTerm" TEXT,
  ADD COLUMN "firstLandingPage" TEXT,
  ADD COLUMN "firstReferrer" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Lead" SET
  "normalizedPhone" = regexp_replace("phone", '[^0-9+]', '', 'g'),
  "normalizedEmail" = lower(trim("email")),
  "firstUtmSource" = "utmSource",
  "firstUtmMedium" = "utmMedium",
  "firstUtmCampaign" = "utmCampaign",
  "firstUtmContent" = "utmContent",
  "firstUtmTerm" = "utmTerm",
  "firstLandingPage" = "landingPage",
  "firstReferrer" = "referrer";

CREATE TABLE "LeadActivity" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "type" "LeadActivityType" NOT NULL,
  "actor" TEXT NOT NULL,
  "fromStatus" "LeadStatus",
  "toStatus" "LeadStatus",
  "message" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

INSERT INTO "LeadActivity" ("id", "leadId", "type", "actor", "message", "createdAt")
SELECT 'migrated-' || "id", "id", 'CREATED', 'Systém', 'Lead bol importovaný do CRM.', "createdAt" FROM "Lead";

CREATE TABLE "CampaignEvent" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "leadId" TEXT,
  "eventId" TEXT,
  "type" "CampaignEventType" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaDailyMetric" (
  "id" TEXT NOT NULL,
  "metaAdCampaignId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "spendCents" INTEGER NOT NULL DEFAULT 0,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "metaLeads" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MetaDailyMetric_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_campaignId_status_createdAt_idx" ON "Lead"("campaignId", "status", "createdAt");
CREATE INDEX "Lead_nextFollowUpAt_idx" ON "Lead"("nextFollowUpAt");
CREATE INDEX "Lead_normalizedPhone_createdAt_idx" ON "Lead"("normalizedPhone", "createdAt");
CREATE INDEX "Lead_normalizedEmail_createdAt_idx" ON "Lead"("normalizedEmail", "createdAt");
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");
CREATE UNIQUE INDEX "CampaignEvent_eventId_key" ON "CampaignEvent"("eventId");
CREATE INDEX "CampaignEvent_type_campaignId_occurredAt_idx" ON "CampaignEvent"("type", "campaignId", "occurredAt");
CREATE INDEX "CampaignEvent_campaignId_occurredAt_idx" ON "CampaignEvent"("campaignId", "occurredAt");
CREATE UNIQUE INDEX "MetaDailyMetric_metaAdCampaignId_date_key" ON "MetaDailyMetric"("metaAdCampaignId", "date");
CREATE INDEX "MetaDailyMetric_date_idx" ON "MetaDailyMetric"("date");

ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetaDailyMetric" ADD CONSTRAINT "MetaDailyMetric_metaAdCampaignId_fkey" FOREIGN KEY ("metaAdCampaignId") REFERENCES "MetaAdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
