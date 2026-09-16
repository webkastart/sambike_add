import "dotenv/config";

import { createHash } from "node:crypto";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const sourceSetting = process.env.SQLITE_SOURCE_PATH?.trim();
const targetUrl = process.env.DATABASE_URL?.trim();
if (!sourceSetting) throw new Error("Nastavte SQLITE_SOURCE_PATH na existujúci SQLite súbor.");
if (!targetUrl?.startsWith("postgresql://") && !targetUrl?.startsWith("postgres://")) {
  throw new Error("DATABASE_URL musí smerovať na cieľový PostgreSQL, nie na SQLite.");
}

const sourcePath = resolve(sourceSetting);
const sqlite = new Database(sourcePath, { readonly: true, fileMustExist: true });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: targetUrl }) });
type Row = Record<string, unknown>;

function hasTable(name: string) {
  return Boolean(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function rows(name: string) {
  return hasTable(name) ? sqlite.prepare(`SELECT * FROM "${name}"`).all() as Row[] : [];
}

function date(value: unknown) {
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error(`Neplatný dátum v SQLite importe: ${String(value)}`);
  return parsed;
}

function nullable(value: unknown) {
  return value == null || value === "" ? null : String(value);
}

const campaigns = rows("Campaign");
if (campaigns.length === 0) throw new Error("Zdrojová SQLite databáza neobsahuje žiadne kampane; import bol zastavený.");

try {
  await prisma.campaign.createMany({
    skipDuplicates: true,
    data: campaigns.map((row) => ({
      id: String(row.id), name: String(row.name), slug: String(row.slug), headline: String(row.headline),
      description: String(row.description), imageUrl: String(row.imageUrl), offerImageUrl: nullable(row.offerImageUrl),
      galleryImage1Url: nullable(row.galleryImage1Url), galleryImage2Url: nullable(row.galleryImage2Url), galleryImage3Url: nullable(row.galleryImage3Url),
      priceText: String(row.priceText), ctaText: String(row.ctaText), offerType: String(row.offerType), phone: String(row.phone), email: String(row.email),
      formEnabled: Boolean(row.formEnabled), isActive: Boolean(row.isActive), createdAt: date(row.createdAt), updatedAt: date(row.updatedAt),
    })),
  });

  const gallery = rows("CampaignGalleryImage");
  if (gallery.length) await prisma.campaignGalleryItem.createMany({
    skipDuplicates: true,
    data: gallery.map((row) => ({ id: String(row.id), campaignId: String(row.campaignId), mediaUrl: String(row.imageUrl), mediaType: String(row.mediaType || "IMAGE"), sortOrder: Number(row.sortOrder), createdAt: date(row.createdAt) })),
  });

  const leads = rows("Lead");
  if (leads.length) {
    await prisma.lead.createMany({
      skipDuplicates: true,
      data: leads.map((row) => ({
        id: String(row.id), campaignId: String(row.campaignId), name: String(row.name), phone: String(row.phone), email: nullable(row.email),
        normalizedPhone: String(row.phone).replace(/[^0-9+]/g, ""), normalizedEmail: nullable(row.email)?.toLowerCase() || null,
        interestType: String(row.interestType), note: nullable(row.note), consent: Boolean(row.consent), consentAt: date(row.createdAt),
        consentVersion: "legacy-import-2026-09", dedupeKey: createHash("sha256").update(`legacy:${String(row.id)}`).digest("hex"),
        campaignSlug: nullable(row.campaignSlug), utmSource: nullable(row.utmSource), utmMedium: nullable(row.utmMedium), utmCampaign: nullable(row.utmCampaign),
        utmContent: nullable(row.utmContent), utmTerm: nullable(row.utmTerm), landingPage: nullable(row.landingPage), referrer: nullable(row.referrer), createdAt: date(row.createdAt),
        firstUtmSource: nullable(row.utmSource), firstUtmMedium: nullable(row.utmMedium), firstUtmCampaign: nullable(row.utmCampaign), firstUtmContent: nullable(row.utmContent),
        firstUtmTerm: nullable(row.utmTerm), firstLandingPage: nullable(row.landingPage), firstReferrer: nullable(row.referrer),
      })),
    });
    await prisma.leadActivity.createMany({
      skipDuplicates: true,
      data: leads.map((row) => ({
        id: `legacy-created-${String(row.id)}`,
        leadId: String(row.id),
        type: "CREATED",
        actor: "Migrácia",
        message: "Lead bol importovaný zo staršej databázy.",
        createdAt: date(row.createdAt),
      })),
    });
  }

  const recipients = rows("LeadNotificationRecipient");
  if (recipients.length) await prisma.leadNotificationRecipient.createMany({
    skipDuplicates: true,
    data: recipients.map((row) => ({ email: String(row.email), enabled: Boolean(row.enabled), updatedAt: date(row.updatedAt) })),
  });

  const metaAds = rows("MetaAdCampaign");
  if (metaAds.length) await prisma.metaAdCampaign.createMany({
    skipDuplicates: true,
    data: metaAds.map((row) => ({
      id: String(row.id), campaignId: String(row.campaignId), metaCampaignId: nullable(row.metaCampaignId), metaAdSetId: nullable(row.metaAdSetId),
      metaCreativeId: nullable(row.metaCreativeId), metaAdId: nullable(row.metaAdId), status: String(row.status), effectiveStatus: nullable(row.effectiveStatus),
      platforms: String(row.platforms), dailyBudgetCents: Number(row.dailyBudgetCents), radiusKm: Number(row.radiusKm), minAge: Number(row.minAge), maxAge: Number(row.maxAge),
      primaryText: String(row.primaryText), adHeadline: String(row.adHeadline), adDescription: nullable(row.adDescription), destinationUrl: String(row.destinationUrl),
      startsAt: row.startsAt ? date(row.startsAt) : null, endsAt: row.endsAt ? date(row.endsAt) : null, spendCents: Number(row.spendCents), impressions: Number(row.impressions),
      clicks: Number(row.clicks), metaLeads: Number(row.metaLeads), lastSyncedAt: row.lastSyncedAt ? date(row.lastSyncedAt) : null, lastError: nullable(row.lastError),
      createdAt: date(row.createdAt), updatedAt: date(row.updatedAt),
    })),
  });

  console.log(`Import dokončený bez mazania zdroja: ${campaigns.length} kampaní, ${leads.length} leadov.`);
} finally {
  sqlite.close();
  await prisma.$disconnect();
}
