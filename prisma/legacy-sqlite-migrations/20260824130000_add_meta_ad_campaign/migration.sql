-- CreateTable
CREATE TABLE "MetaAdCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "metaCampaignId" TEXT,
    "metaAdSetId" TEXT,
    "metaCreativeId" TEXT,
    "metaAdId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "effectiveStatus" TEXT,
    "platforms" TEXT NOT NULL,
    "dailyBudgetCents" INTEGER NOT NULL,
    "radiusKm" INTEGER NOT NULL,
    "minAge" INTEGER NOT NULL,
    "maxAge" INTEGER NOT NULL,
    "primaryText" TEXT NOT NULL,
    "adHeadline" TEXT NOT NULL,
    "adDescription" TEXT,
    "destinationUrl" TEXT NOT NULL,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "spendCents" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "metaLeads" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MetaAdCampaign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdCampaign_campaignId_key" ON "MetaAdCampaign"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdCampaign_metaCampaignId_key" ON "MetaAdCampaign"("metaCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdCampaign_metaAdSetId_key" ON "MetaAdCampaign"("metaAdSetId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdCampaign_metaCreativeId_key" ON "MetaAdCampaign"("metaCreativeId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdCampaign_metaAdId_key" ON "MetaAdCampaign"("metaAdId");

-- CreateIndex
CREATE INDEX "MetaAdCampaign_status_idx" ON "MetaAdCampaign"("status");
