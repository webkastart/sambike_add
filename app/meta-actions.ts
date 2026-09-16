"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createRemoteMetaAd,
  deleteRemoteMetaAd,
  fetchMetaAdPreviews,
  getMetaConnectionSummary,
  MetaAdsError,
  setRemoteMetaAdStatus,
  setRemoteMetaAdBudget,
  syncRemoteMetaAd,
  verifyMetaConnection,
  type MetaAdDraftInput,
} from "@/lib/meta-ads";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { persistMetaAdSync } from "@/lib/meta-sync";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function numberValue(formData: FormData, name: string) {
  return Number(value(formData, name));
}

function optionalDate(formData: FormData, name: string) {
  const raw = value(formData, name);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new MetaAdsError("Dátum reklamy nie je platný.");
  return parsed;
}

function parseDraftInput(formData: FormData): MetaAdDraftInput {
  const primaryText = value(formData, "primaryText").slice(0, 1000);
  const headline = value(formData, "adHeadline").slice(0, 255);
  const description = value(formData, "adDescription").slice(0, 255);
  const dailyBudgetCents = Math.round(numberValue(formData, "dailyBudget") * 100);
  const radiusKm = Math.round(numberValue(formData, "radiusKm"));
  const minAge = Math.round(numberValue(formData, "minAge"));
  const maxAge = Math.round(numberValue(formData, "maxAge"));
  const platforms = formData.getAll("platform").filter(
    (platform): platform is "facebook" | "instagram" => platform === "facebook" || platform === "instagram",
  );
  const startsAt = optionalDate(formData, "startsAt");
  const endsAt = optionalDate(formData, "endsAt");

  if (!primaryText || !headline) throw new MetaAdsError("Doplňte hlavný text a nadpis reklamy.");
  const maxBudget = getMetaConnectionSummary().maxCampaignDailyBudgetCents;
  if (dailyBudgetCents < 500 || dailyBudgetCents > maxBudget) {
    throw new MetaAdsError(`Denný rozpočet musí byť od 5 € do ${(maxBudget / 100).toFixed(2)} €.`);
  }
  if (radiusKm < 1 || radiusKm > 80) throw new MetaAdsError("Okruh musí byť od 1 do 80 km.");
  if (minAge < 18 || minAge > 65 || maxAge < minAge || maxAge > 65) {
    throw new MetaAdsError("Vek publika musí byť v rozsahu 18 až 65+.");
  }
  if (platforms.length === 0) throw new MetaAdsError("Vyberte Facebook, Instagram alebo obe platformy.");
  if (endsAt && endsAt.getTime() <= Date.now() + 60 * 60 * 1000) {
    throw new MetaAdsError("Koniec reklamy musí byť aspoň hodinu v budúcnosti.");
  }
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new MetaAdsError("Koniec reklamy musí byť neskôr ako začiatok.");
  }

  return {
    primaryText,
    headline,
    description,
    dailyBudgetCents,
    radiusKm,
    minAge,
    maxAge,
    platforms: [...new Set(platforms)],
    startsAt,
    endsAt,
  };
}

function errorMessage(error: unknown) {
  if (error instanceof MetaAdsError) return error.message;
  console.error("Meta reklamu sa nepodarilo spracovať:", error);
  return "Reklamu sa nepodarilo spracovať. Skúste to znova alebo skontrolujte Meta účet.";
}

function campaignPath(campaignId: string, query: Record<string, string>) {
  const params = new URLSearchParams(query);
  return `/admin/kampane/${campaignId}?${params}`;
}

export async function verifyMetaConnectionAction() {
  await requireAdmin();
  try {
    const result = await verifyMetaConnection();
    const connection = getMetaConnectionSummary();
    await prisma.metaConnectionCheck.upsert({
      where: { id: "default" },
      create: { id: "default", mode: connection.mode, adAccountId: connection.adAccountId, currency: result.currency || null, accountName: result.accountName, accountStatus: result.accountStatus, timezoneName: result.timezoneName || null, spendCapCents: result.spendCapCents, amountSpentCents: result.amountSpentCents, verifiedAt: new Date() },
      update: { mode: connection.mode, adAccountId: connection.adAccountId, currency: result.currency || null, accountName: result.accountName, accountStatus: result.accountStatus, timezoneName: result.timezoneName || null, spendCapCents: result.spendCapCents, amountSpentCents: result.amountSpentCents, verifiedAt: new Date() },
    });
  } catch (error) {
    redirect(`/admin/nastavenia?metaError=${encodeURIComponent(errorMessage(error))}`);
  }
  redirect("/admin/nastavenia?metaVerified=1");
}

export async function createMetaAd(campaignId: string, formData: FormData) {
  const { actor } = await requireAdmin();
  let localAdId = "";

  try {
    const input = parseDraftInput(formData);
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { metaAd: true },
    });
    if (!campaign) throw new MetaAdsError("Kampaň už neexistuje.");
    if (campaign.status !== "PUBLISHED") throw new MetaAdsError("Pred vytvorením reklamy publikujte landing page.");
    if (campaign.metaAd?.metaCampaignId) throw new MetaAdsError("Táto kampaň už má vytvorenú Meta reklamu.");
    const connection = getMetaConnectionSummary();
    if (input.dailyBudgetCents > connection.maxCampaignDailyBudgetCents) throw new MetaAdsError(`Denný rozpočet prekračuje limit kampane ${(connection.maxCampaignDailyBudgetCents / 100).toFixed(2)} €.`);
    const total = await prisma.metaAdCampaign.aggregate({ where: { status: "ACTIVE", campaignId: { not: campaignId } }, _sum: { dailyBudgetCents: true } });
    if ((total._sum.dailyBudgetCents ?? 0) + input.dailyBudgetCents > connection.maxGlobalDailyBudgetCents) throw new MetaAdsError(`Súčet aktívnych rozpočtov by prekročil globálny limit ${(connection.maxGlobalDailyBudgetCents / 100).toFixed(2)} €.`);
    const verified = await prisma.metaConnectionCheck.findUnique({ where: { id: "default" } });
    if (connection.mode === "live" && (!verified || verified.mode !== connection.mode || verified.adAccountId !== connection.adAccountId)) throw new MetaAdsError("Po zmene režimu alebo účtu najprv znovu overte Meta spojenie v nastaveniach.");
    if (connection.mode === "live" && verified?.currency !== "EUR") throw new MetaAdsError(`Reklamný účet používa menu ${verified?.currency || "neznámu"}; povolená je iba EUR.`);

    const destinationUrl = new URL(`/kampan/${campaign.slug}`, process.env.APP_URL || "http://localhost:3000").toString();
    const localAd = campaign.metaAd
      ? await prisma.metaAdCampaign.update({
          where: { id: campaign.metaAd.id },
          data: {
            status: "CREATING",
            platforms: input.platforms.join(","),
            dailyBudgetCents: input.dailyBudgetCents,
            radiusKm: input.radiusKm,
            minAge: input.minAge,
            maxAge: input.maxAge,
            primaryText: input.primaryText,
            adHeadline: input.headline,
            adDescription: input.description || null,
            destinationUrl,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            lastError: null,
            mode: connection.mode,
            currency: verified?.currency || "EUR",
          },
        })
      : await prisma.metaAdCampaign.create({
          data: {
            campaignId,
            status: "CREATING",
            platforms: input.platforms.join(","),
            dailyBudgetCents: input.dailyBudgetCents,
            radiusKm: input.radiusKm,
            minAge: input.minAge,
            maxAge: input.maxAge,
            primaryText: input.primaryText,
            adHeadline: input.headline,
            adDescription: input.description || null,
            destinationUrl,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            mode: connection.mode,
            currency: verified?.currency || "EUR",
          },
        });
    localAdId = localAd.id;

    if (connection.mode === "sandbox") {
      await prisma.$transaction([
        prisma.metaAdCampaign.update({ where: { id: localAd.id }, data: { status: "PAUSED", effectiveStatus: "SANDBOX_PAUSED", lastError: null } }),
        prisma.campaignAudit.create({ data: { campaignId, action: "META_CREATED", actor, metadata: { mode: "sandbox", remoteObjectsCreated: false } } }),
      ]);
    } else {
      const remote = await createRemoteMetaAd(
        { name: campaign.name, slug: campaign.slug, imageUrl: campaign.imageUrl },
        input,
      );
      await prisma.$transaction([
        prisma.metaAdCampaign.update({ where: { id: localAd.id }, data: { ...remote, status: "PAUSED", effectiveStatus: "PAUSED", lastError: null } }),
        prisma.campaignAudit.create({ data: { campaignId, action: "META_CREATED", actor, metadata: { mode: "live", createdPaused: true } } }),
      ]);
    }
  } catch (error) {
    const message = errorMessage(error);
    if (localAdId) {
      await prisma.metaAdCampaign.update({
        where: { id: localAdId },
        data: { status: "ERROR", lastError: message },
      }).catch(() => undefined);
    }
    redirect(campaignPath(campaignId, { metaError: message }));
  }

  revalidatePath(`/admin/kampane/${campaignId}`);
  redirect(campaignPath(campaignId, { metaCreated: "1" }));
}

function remoteIds(ad: {
  metaCampaignId: string | null;
  metaAdSetId: string | null;
  metaAdId: string | null;
}) {
  if (!ad.metaCampaignId || !ad.metaAdSetId || !ad.metaAdId) {
    throw new MetaAdsError("Meta reklama nemá všetky vzdialené identifikátory.");
  }
  return { campaignId: ad.metaCampaignId, adSetId: ad.metaAdSetId, adId: ad.metaAdId };
}

export async function setMetaAdStatus(campaignId: string, status: "ACTIVE" | "PAUSED") {
  const { actor } = await requireAdmin();
  try {
    const ad = await prisma.metaAdCampaign.findUniqueOrThrow({
      where: { campaignId },
      include: { campaign: { select: { status: true } } },
    });
    const connection = getMetaConnectionSummary();
    if (status === "ACTIVE" && ad.campaign.status !== "PUBLISHED") {
      throw new MetaAdsError("Najprv publikujte landing page.");
    }
    if (status === "ACTIVE") {
      if (connection.mode !== "live" || ad.mode !== "live") throw new MetaAdsError("Sandbox reklamu nemožno aktivovať. Prepnite vedome na live, overte spojenie a vytvorte live koncept.");
      const verified = await prisma.metaConnectionCheck.findUnique({ where: { id: "default" } });
      if (!verified || verified.mode !== "live" || verified.adAccountId !== connection.adAccountId) throw new MetaAdsError("Live spojenie nebolo po zmene režimu overené.");
      if (verified.currency !== "EUR" || ad.currency !== "EUR") throw new MetaAdsError("Aktivácia je povolená iba pre účet a reklamu v EUR.");
      if (ad.dailyBudgetCents > connection.maxCampaignDailyBudgetCents) throw new MetaAdsError("Rozpočet prekračuje limit jednej kampane.");
      const activeBudgets = await prisma.metaAdCampaign.aggregate({ where: { status: "ACTIVE", id: { not: ad.id } }, _sum: { dailyBudgetCents: true } });
      if ((activeBudgets._sum.dailyBudgetCents ?? 0) + ad.dailyBudgetCents > connection.maxGlobalDailyBudgetCents) throw new MetaAdsError("Aktivácia by prekročila globálny denný limit.");
    }
    if (ad.mode === "sandbox" && status === "PAUSED") {
      await prisma.metaAdCampaign.update({ where: { id: ad.id }, data: { status: "PAUSED", effectiveStatus: "SANDBOX_PAUSED", lastError: null } });
    } else {
      await setRemoteMetaAdStatus(remoteIds(ad), status);
      await prisma.metaAdCampaign.update({ where: { id: ad.id }, data: { status, effectiveStatus: status, lastError: null } });
    }
    await prisma.campaignAudit.create({ data: { campaignId, action: status === "ACTIVE" ? "META_ACTIVATED" : "META_PAUSED", actor, metadata: { mode: ad.mode, dailyBudgetCents: ad.dailyBudgetCents } } });
  } catch (error) {
    const message = errorMessage(error);
    await prisma.metaAdCampaign.updateMany({ where: { campaignId }, data: { lastError: message } });
    redirect(campaignPath(campaignId, { metaError: message }));
  }
  revalidatePath(`/admin/kampane/${campaignId}`);
  redirect(campaignPath(campaignId, { metaStatus: status.toLowerCase() }));
}

export async function syncMetaAd(campaignId: string) {
  await requireAdmin();
  try {
    const ad = await prisma.metaAdCampaign.findUniqueOrThrow({ where: { campaignId } });
    if (!ad.metaCampaignId) throw new MetaAdsError("Meta kampaň ešte nebola vytvorená.");
    const remote = await syncRemoteMetaAd(ad.metaCampaignId);
    await persistMetaAdSync(ad.id, remote);
    if (ad.metaAdId) {
      const previews = await fetchMetaAdPreviews(ad.metaAdId, ad.platforms).catch(() => null);
      if (previews) await prisma.metaAdCampaign.update({ where: { id: ad.id }, data: { ...previews, lastPreviewAt: new Date() } });
    }
  } catch (error) {
    const message = errorMessage(error);
    await prisma.metaAdCampaign.updateMany({ where: { campaignId }, data: { lastError: message } });
    redirect(campaignPath(campaignId, { metaError: message }));
  }
  revalidatePath(`/admin/kampane/${campaignId}`);
  redirect(campaignPath(campaignId, { metaSynced: "1" }));
}

export async function updateMetaAdBudget(campaignId: string, formData: FormData) {
  const { actor } = await requireAdmin();
  try {
    const ad = await prisma.metaAdCampaign.findUniqueOrThrow({ where: { campaignId } });
    const cents = Math.round(numberValue(formData, "dailyBudget") * 100);
    const connection = getMetaConnectionSummary();
    if (!Number.isSafeInteger(cents) || cents < 500 || cents > connection.maxCampaignDailyBudgetCents) throw new MetaAdsError("Rozpočet je mimo povoleného limitu kampane.");
    const others = await prisma.metaAdCampaign.aggregate({ where: { status: "ACTIVE", id: { not: ad.id } }, _sum: { dailyBudgetCents: true } });
    if ((others._sum.dailyBudgetCents ?? 0) + cents > connection.maxGlobalDailyBudgetCents) throw new MetaAdsError("Rozpočet by prekročil globálny denný limit.");
    if (ad.mode === "live") {
      if (!ad.metaAdSetId) throw new MetaAdsError("Meta ad set nemá vzdialený identifikátor.");
      await setRemoteMetaAdBudget(ad.metaAdSetId, cents);
    }
    await prisma.$transaction([
      prisma.metaAdCampaign.update({ where: { id: ad.id }, data: { dailyBudgetCents: cents, lastError: null } }),
      prisma.campaignAudit.create({ data: { campaignId, action: "META_BUDGET_CHANGED", actor, metadata: { fromCents: ad.dailyBudgetCents, toCents: cents, mode: ad.mode } } }),
    ]);
  } catch (error) {
    const message = errorMessage(error);
    await prisma.metaAdCampaign.updateMany({ where: { campaignId }, data: { lastError: message } });
    redirect(campaignPath(campaignId, { metaError: message }));
  }
  revalidatePath(`/admin/kampane/${campaignId}`);
  redirect(campaignPath(campaignId, { metaBudget: "1" }));
}

export async function emergencyPauseAllMetaAds() {
  const { actor } = await requireAdmin();
  const ads = await prisma.metaAdCampaign.findMany({ where: { status: "ACTIVE" } });
  let paused = 0;
  const failed: string[] = [];
  for (const ad of ads) {
    try {
      await setRemoteMetaAdStatus(remoteIds(ad), "PAUSED");
      await prisma.$transaction([
        prisma.metaAdCampaign.update({ where: { id: ad.id }, data: { status: "PAUSED", effectiveStatus: "PAUSED", lastError: null } }),
        prisma.campaignAudit.create({ data: { campaignId: ad.campaignId, action: "META_EMERGENCY_PAUSE", actor, metadata: { ok: true } } }),
      ]);
      paused += 1;
    } catch (error) {
      const message = errorMessage(error);
      failed.push(ad.id);
      await prisma.$transaction([
        prisma.metaAdCampaign.update({ where: { id: ad.id }, data: { lastError: message } }),
        prisma.campaignAudit.create({ data: { campaignId: ad.campaignId, action: "META_EMERGENCY_PAUSE", actor, metadata: { ok: false, error: message } } }),
      ]);
    }
  }
  revalidatePath("/admin");
  redirect(`/admin/nastavenia?emergencyPaused=${paused}&emergencyFailed=${failed.length}`);
}

export async function deleteMetaAd(campaignId: string) {
  await requireAdmin();
  try {
    const ad = await prisma.metaAdCampaign.findUniqueOrThrow({ where: { campaignId } });
    if (ad.metaCampaignId) await deleteRemoteMetaAd(ad.metaCampaignId);
    await prisma.metaAdCampaign.delete({ where: { id: ad.id } });
  } catch (error) {
    const message = errorMessage(error);
    redirect(campaignPath(campaignId, { metaError: message }));
  }
  revalidatePath(`/admin/kampane/${campaignId}`);
  redirect(campaignPath(campaignId, { metaDeleted: "1" }));
}
