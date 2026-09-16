import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { campaignReadiness, publicationSnapshot } from "@/lib/campaign-workflow";
import { setRemoteMetaAdStatus } from "@/lib/meta-ads";
import { prisma } from "@/lib/prisma";

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "Neznáma chyba plánovača.").replace(/(token|secret|authorization)=[^\s&]+/gi, "$1=[redacted]").slice(0, 500);
}

export async function runCampaignSchedule(now = new Date()) {
  const [publishDue, unpublishDue] = await Promise.all([
    prisma.campaign.findMany({ where: { status: { in: ["DRAFT", "READY", "PAUSED"] }, publishAt: { lte: now } }, include: { galleryItems: { orderBy: { sortOrder: "asc" } }, metaAd: true } }),
    prisma.campaign.findMany({ where: { status: "PUBLISHED", unpublishAt: { lte: now } }, include: { metaAd: true } }),
  ]);
  const results: Array<{ id: string; operation: "publish" | "unpublish"; ok: boolean }> = [];

  for (const campaign of publishDue) {
    try {
      const duplicateSlug = await prisma.campaign.count({ where: { slug: campaign.slug, NOT: { id: campaign.id } } });
      const readiness = campaignReadiness(campaign, { slugUnique: duplicateSlug === 0, appUrl: process.env.APP_URL, requireProductionUrl: process.env.NODE_ENV === "production" });
      if (!readiness.ready) throw new Error(`Kontrola pripravenosti: ${readiness.items.filter((item) => item.level === "required" && !item.ready).map((item) => item.label).join(", ")}`);
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.campaign.updateMany({ where: { id: campaign.id, status: { in: ["DRAFT", "READY", "PAUSED"] }, publishAt: { lte: now } }, data: { status: "PUBLISHED", publishedAt: now, publishAt: null, scheduleError: null } });
        if (claimed.count === 0) return;
        const latest = await tx.campaignPublication.aggregate({ where: { campaignId: campaign.id }, _max: { version: true } });
        await tx.campaignPublication.create({ data: { campaignId: campaign.id, version: (latest._max.version ?? 0) + 1, snapshot: publicationSnapshot(campaign) as Prisma.InputJsonValue, actor: "Plánovač", publishedAt: now } });
        await tx.campaignAudit.create({ data: { campaignId: campaign.id, action: "PUBLISHED", actor: "Plánovač", metadata: { scheduled: true } } });
      });
      results.push({ id: campaign.id, operation: "publish", ok: true });
    } catch (error) {
      await prisma.campaign.update({ where: { id: campaign.id }, data: { scheduleError: safeError(error) } });
      results.push({ id: campaign.id, operation: "publish", ok: false });
    }
  }

  for (const campaign of unpublishDue) {
    try {
      const ad = campaign.metaAd;
      if (ad?.status === "ACTIVE") {
        if (!ad.metaCampaignId || !ad.metaAdSetId || !ad.metaAdId) throw new Error("Aktívna Meta reklama nemá úplné vzdialené identifikátory.");
        await setRemoteMetaAdStatus({ campaignId: ad.metaCampaignId, adSetId: ad.metaAdSetId, adId: ad.metaAdId }, "PAUSED");
        await prisma.metaAdCampaign.update({ where: { id: ad.id }, data: { status: "PAUSED", effectiveStatus: "PAUSED", lastError: null } });
      }
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.campaign.updateMany({ where: { id: campaign.id, status: "PUBLISHED", unpublishAt: { lte: now } }, data: { status: "PAUSED", unpublishAt: null, scheduleError: null } });
        if (claimed.count) await tx.campaignAudit.create({ data: { campaignId: campaign.id, action: "PAUSED", actor: "Plánovač", metadata: { scheduled: true } } });
      });
      results.push({ id: campaign.id, operation: "unpublish", ok: true });
    } catch (error) {
      await prisma.campaign.update({ where: { id: campaign.id }, data: { scheduleError: safeError(error) } });
      results.push({ id: campaign.id, operation: "unpublish", ok: false });
    }
  }
  return results;
}
