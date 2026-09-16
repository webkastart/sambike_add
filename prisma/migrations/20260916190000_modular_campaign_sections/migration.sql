CREATE TYPE "CampaignSectionType" AS ENUM (
  'HERO',
  'TEXT_IMAGE',
  'BENEFITS',
  'OFFER',
  'GALLERY',
  'VIDEO',
  'FAQ',
  'TESTIMONIALS',
  'CTA',
  'FORM'
);

CREATE TABLE "CampaignSection" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "type" "CampaignSectionType" NOT NULL,
  "position" INTEGER NOT NULL,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "content" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignSection_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CampaignGalleryImage" ADD COLUMN "sectionId" TEXT;

CREATE INDEX "CampaignSection_campaignId_position_idx" ON "CampaignSection"("campaignId", "position");
CREATE INDEX "CampaignSection_campaignId_type_idx" ON "CampaignSection"("campaignId", "type");
CREATE INDEX "CampaignGalleryImage_sectionId_sortOrder_idx" ON "CampaignGalleryImage"("sectionId", "sortOrder");

ALTER TABLE "CampaignSection"
  ADD CONSTRAINT "CampaignSection_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignGalleryImage"
  ADD CONSTRAINT "CampaignGalleryImage_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "CampaignSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill every existing campaign from the legacy campaign columns. The old columns
-- deliberately remain in place as a compatibility layer for publishing, experiments,
-- SEO and older deployments during a rolling release.
INSERT INTO "CampaignSection" ("id", "campaignId", "type", "position", "isVisible", "content", "createdAt", "updatedAt")
SELECT "id" || '-hero', "id", 'HERO', 0, true,
  jsonb_build_object(
    'eyebrow', "offerType",
    'heading', "headline",
    'description', "description",
    'ctaLabel', "ctaText",
    'imageUrl', COALESCE((SELECT media."imageUrl" FROM "CampaignGalleryImage" media WHERE media."campaignId" = "Campaign"."id" AND media."placement" = 'HERO' AND media."mediaType" = 'IMAGE' ORDER BY media."sortOrder" LIMIT 1), "imageUrl"),
    'steps', CASE WHEN jsonb_typeof("processSteps") = 'array' THEN "processSteps" ELSE '[]'::jsonb END
  ), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Campaign";

INSERT INTO "CampaignSection" ("id", "campaignId", "type", "position", "isVisible", "content", "createdAt", "updatedAt")
SELECT "id" || '-benefits', "id", 'BENEFITS', 1, true,
  jsonb_build_object(
    'eyebrow', 'Prečo Sambike',
    'heading', 'Jemný prístup. Poctivý servis.',
    'items', CASE WHEN jsonb_typeof("benefits") = 'array' THEN "benefits" ELSE '[{"title":"Jasný termín","text":"Dostupný termín si spolu potvrdíme telefonicky."},{"title":"Osobný prístup","text":"Najprv si vypočujeme problém a navrhneme ďalší postup."},{"title":"Spoľahlivý výsledok","text":"Bicykel skontrolujeme s dôrazom na bezpečnosť a detail."}]'::jsonb END
  ), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Campaign";

INSERT INTO "CampaignSection" ("id", "campaignId", "type", "position", "isVisible", "content", "createdAt", "updatedAt")
SELECT "id" || '-offer', "id", 'OFFER', 2, true,
  jsonb_build_object(
    'eyebrow', 'Aktuálna ponuka',
    'heading', "name",
    'description', "description",
    'priceText', "priceText",
    'ctaLabel', "ctaText",
    'imageUrl', COALESCE((SELECT media."imageUrl" FROM "CampaignGalleryImage" media WHERE media."campaignId" = "Campaign"."id" AND media."placement" = 'OFFER' AND media."mediaType" = 'IMAGE' ORDER BY media."sortOrder" LIMIT 1), "offerImageUrl", "imageUrl")
  ), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Campaign";

INSERT INTO "CampaignSection" ("id", "campaignId", "type", "position", "isVisible", "content", "createdAt", "updatedAt")
SELECT "id" || '-form', "id", 'FORM', 3, "formEnabled",
  jsonb_build_object(
    'eyebrow', 'Nezáväzná požiadavka',
    'heading', 'Dohodnime si podrobnosti.',
    'description', COALESCE("responseTimeText", 'Stačí meno a telefón. Ozveme sa a spolu dohodneme termín aj rozsah.')
  ), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Campaign";

INSERT INTO "CampaignSection" ("id", "campaignId", "type", "position", "isVisible", "content", "createdAt", "updatedAt")
SELECT "id" || '-gallery', "id", 'GALLERY', 4,
  EXISTS (SELECT 1 FROM "CampaignGalleryImage" media WHERE media."campaignId" = "Campaign"."id" AND media."placement" = 'GALLERY'),
  jsonb_build_object(
    'eyebrow', 'Práca zo servisu',
    'heading', 'Detail, ktorý je vidieť.',
    'description', 'Skutočné fotografie a videá zo servisu Sambike.'
  ), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Campaign";

INSERT INTO "CampaignSection" ("id", "campaignId", "type", "position", "isVisible", "content", "createdAt", "updatedAt")
SELECT "id" || '-faq', "id", 'FAQ', 5, true,
  jsonb_build_object(
    'eyebrow', 'Praktické informácie',
    'heading', 'Časté otázky.',
    'items', CASE WHEN jsonb_typeof("faq") = 'array' THEN "faq" ELSE '[{"question":"Ako si objednám servis?","answer":"Vyplňte krátky formulár alebo nám zavolajte. Následne spolu potvrdíme termín a ďalší postup."},{"question":"Kedy budem poznať termín?","answer":"Po prijatí požiadavky sa vám ozveme a overíme dostupný termín."},{"question":"Čo mám uviesť do poznámky?","answer":"Napíšte typ bicykla, stručný opis problému a želaný termín."}]'::jsonb END
  ), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Campaign";

INSERT INTO "CampaignSection" ("id", "campaignId", "type", "position", "isVisible", "content", "createdAt", "updatedAt")
SELECT "id" || '-testimonials', "id", 'TESTIMONIALS', 6,
  CASE WHEN jsonb_typeof("testimonials") = 'array' THEN jsonb_array_length("testimonials") > 0 ELSE false END,
  jsonb_build_object(
    'eyebrow', 'Referencie zákazníkov',
    'heading', 'Skúsenosti zákazníkov.',
    'items', COALESCE("testimonials", '[]'::jsonb)
  ), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Campaign";

INSERT INTO "CampaignSection" ("id", "campaignId", "type", "position", "isVisible", "content", "createdAt", "updatedAt")
SELECT "id" || '-cta', "id", 'CTA', 7, true,
  jsonb_build_object(
    'eyebrow', 'Dohodnite si termín',
    'heading', COALESCE("finalCtaText", 'Pošlite nám nezáväznú požiadavku.'),
    'ctaLabel', "ctaText",
    'href', CASE WHEN "formEnabled" THEN '#mam-zaujem' ELSE 'mailto:' || "email" END
  ), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Campaign";

UPDATE "CampaignGalleryImage" media
SET "sectionId" = media."campaignId" || '-gallery'
WHERE media."placement" = 'GALLERY';
