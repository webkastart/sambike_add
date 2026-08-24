"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import {
  createRemoteMetaAd,
  deleteRemoteMetaAd,
  MetaAdsError,
  setRemoteMetaAdStatus,
  syncRemoteMetaAd,
  verifyMetaConnection,
  type MetaAdDraftInput,
} from "@/lib/meta-ads";
import { prisma } from "@/lib/prisma";

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
  if (dailyBudgetCents < 500 || dailyBudgetCents > 100_000) {
    throw new MetaAdsError("Denný rozpočet musí byť od 5 € do 1 000 €.");
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
    await verifyMetaConnection();
  } catch (error) {
    redirect(`/admin/nastavenia?metaError=${encodeURIComponent(errorMessage(error))}`);
  }
  redirect("/admin/nastavenia?metaVerified=1");
}

export async function createMetaAd(campaignId: string, formData: FormData) {
  await requireAdmin();
  let localAdId = "";

  try {
    const input = parseDraftInput(formData);
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { metaAd: true },
    });
    if (!campaign) throw new MetaAdsError("Kampaň už neexistuje.");
    if (!campaign.isActive) throw new MetaAdsError("Pred vytvorením reklamy aktivujte stránku kampane.");
    if (campaign.metaAd?.metaCampaignId) throw new MetaAdsError("Táto kampaň už má vytvorenú Meta reklamu.");

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
          },
        });
    localAdId = localAd.id;

    const remote = await createRemoteMetaAd(
      { name: campaign.name, slug: campaign.slug, imageUrl: campaign.imageUrl },
      input,
    );
    await prisma.metaAdCampaign.update({
      where: { id: localAd.id },
      data: {
        ...remote,
        status: "PAUSED",
        effectiveStatus: "PAUSED",
        lastError: null,
      },
    });
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
  await requireAdmin();
  try {
    const ad = await prisma.metaAdCampaign.findUniqueOrThrow({
      where: { campaignId },
      include: { campaign: { select: { isActive: true } } },
    });
    if (status === "ACTIVE" && !ad.campaign.isActive) {
      throw new MetaAdsError("Najprv aktivujte stránku kampane.");
    }
    await setRemoteMetaAdStatus(remoteIds(ad), status);
    await prisma.metaAdCampaign.update({
      where: { id: ad.id },
      data: { status, effectiveStatus: status, lastError: null },
    });
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
    await prisma.metaAdCampaign.update({
      where: { id: ad.id },
      data: { ...remote, lastSyncedAt: new Date(), lastError: null },
    });
  } catch (error) {
    const message = errorMessage(error);
    await prisma.metaAdCampaign.updateMany({ where: { campaignId }, data: { lastError: message } });
    redirect(campaignPath(campaignId, { metaError: message }));
  }
  revalidatePath(`/admin/kampane/${campaignId}`);
  redirect(campaignPath(campaignId, { metaSynced: "1" }));
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
