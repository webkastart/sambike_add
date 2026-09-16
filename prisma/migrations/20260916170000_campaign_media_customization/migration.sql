ALTER TABLE "CampaignGalleryImage"
  ADD COLUMN "caption" TEXT,
  ADD COLUMN "placement" TEXT NOT NULL DEFAULT 'GALLERY';

ALTER TABLE "CampaignGalleryImage"
  ADD CONSTRAINT "CampaignGalleryImage_placement_check"
  CHECK ("placement" IN ('GALLERY', 'HERO', 'OFFER', 'BEFORE', 'AFTER'));

CREATE INDEX "CampaignGalleryImage_campaignId_placement_sortOrder_idx"
  ON "CampaignGalleryImage"("campaignId", "placement", "sortOrder");
