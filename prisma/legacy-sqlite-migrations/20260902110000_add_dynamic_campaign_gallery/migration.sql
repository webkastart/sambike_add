-- CreateTable
CREATE TABLE "CampaignGalleryImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignGalleryImage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Preserve photographs saved through the former three fixed gallery fields.
INSERT INTO "CampaignGalleryImage" ("id", "campaignId", "imageUrl", "sortOrder")
SELECT "id" || '-gallery-1', "id", "galleryImage1Url", 0
FROM "Campaign"
WHERE "galleryImage1Url" IS NOT NULL AND trim("galleryImage1Url") <> '';

INSERT INTO "CampaignGalleryImage" ("id", "campaignId", "imageUrl", "sortOrder")
SELECT "id" || '-gallery-2', "id", "galleryImage2Url", 1
FROM "Campaign"
WHERE "galleryImage2Url" IS NOT NULL AND trim("galleryImage2Url") <> '';

INSERT INTO "CampaignGalleryImage" ("id", "campaignId", "imageUrl", "sortOrder")
SELECT "id" || '-gallery-3', "id", "galleryImage3Url", 2
FROM "Campaign"
WHERE "galleryImage3Url" IS NOT NULL AND trim("galleryImage3Url") <> '';

-- CreateIndex
CREATE INDEX "CampaignGalleryImage_campaignId_sortOrder_idx" ON "CampaignGalleryImage"("campaignId", "sortOrder");
