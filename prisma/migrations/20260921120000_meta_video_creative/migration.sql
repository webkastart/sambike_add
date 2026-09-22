ALTER TABLE "MetaAdCampaign"
  ADD COLUMN "creativeMediaType" TEXT NOT NULL DEFAULT 'IMAGE',
  ADD COLUMN "creativeMediaUrl" TEXT;

UPDATE "MetaAdCampaign" AS ad
SET "creativeMediaUrl" = campaign."imageUrl"
FROM "Campaign" AS campaign
WHERE campaign."id" = ad."campaignId";

ALTER TABLE "MetaAdCampaign"
  ALTER COLUMN "creativeMediaUrl" SET NOT NULL;
