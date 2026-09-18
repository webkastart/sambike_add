import "server-only";

import { prisma } from "@/lib/prisma";
import type { CampaignMediaLibraryItem } from "@/lib/campaign-media-library-types";

type LibraryEntry = CampaignMediaLibraryItem & { lastUsedTimestamp: number };

function campaignMediaUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function contentUrl(content: unknown, key: string) {
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  const value = (content as Record<string, unknown>)[key];
  return campaignMediaUrl(value) ? value : null;
}

function inferredMediaType(mediaUrl: string): "IMAGE" | "VIDEO" {
  try {
    const pathname = new URL(mediaUrl, "https://sambike.invalid").pathname;
    return pathname.toLowerCase().endsWith(".mp4") ? "VIDEO" : "IMAGE";
  } catch {
    return "IMAGE";
  }
}

export async function getCampaignMediaLibrary(currentCampaignId?: string): Promise<CampaignMediaLibraryItem[]> {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      imageUrl: true,
      offerImageUrl: true,
      galleryImage1Url: true,
      galleryImage2Url: true,
      galleryImage3Url: true,
      ogImageUrl: true,
      experiment: { select: { variantImageUrl: true, updatedAt: true } },
      sections: { select: { content: true, updatedAt: true } },
      galleryItems: {
        orderBy: { createdAt: "desc" },
        select: { mediaUrl: true, mediaType: true, caption: true, createdAt: true },
      },
    },
  });
  const entries = new Map<string, LibraryEntry>();

  function add(input: {
    mediaUrl: string | null | undefined;
    mediaType?: string;
    campaignId: string;
    campaignName: string;
    label?: string | null;
    usedAt: Date;
  }) {
    if (!campaignMediaUrl(input.mediaUrl)) return;
    const timestamp = input.usedAt.getTime();
    const current = entries.get(input.mediaUrl);
    if (current) {
      if (!current.campaignIds.includes(input.campaignId)) {
        current.campaignIds.push(input.campaignId);
        current.campaignNames.push(input.campaignName);
      }
      if (!current.label && input.label) current.label = input.label;
      if (timestamp > current.lastUsedTimestamp) {
        current.lastUsedTimestamp = timestamp;
        current.lastUsedAt = input.usedAt.toISOString();
      }
      return;
    }
    entries.set(input.mediaUrl, {
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType === "VIDEO" ? "VIDEO" : inferredMediaType(input.mediaUrl),
      campaignIds: [input.campaignId],
      campaignNames: [input.campaignName],
      label: input.label?.trim() || null,
      lastUsedAt: input.usedAt.toISOString(),
      lastUsedTimestamp: timestamp,
    });
  }

  for (const campaign of campaigns) {
    for (const item of campaign.galleryItems) {
      add({
        mediaUrl: item.mediaUrl,
        mediaType: item.mediaType,
        campaignId: campaign.id,
        campaignName: campaign.name,
        label: item.caption,
        usedAt: item.createdAt,
      });
    }
    for (const mediaUrl of [
      campaign.imageUrl,
      campaign.offerImageUrl,
      campaign.galleryImage1Url,
      campaign.galleryImage2Url,
      campaign.galleryImage3Url,
      campaign.ogImageUrl,
    ]) {
      add({ mediaUrl, mediaType: "IMAGE", campaignId: campaign.id, campaignName: campaign.name, usedAt: campaign.updatedAt });
    }
    if (campaign.experiment) {
      add({
        mediaUrl: campaign.experiment.variantImageUrl,
        mediaType: "IMAGE",
        campaignId: campaign.id,
        campaignName: campaign.name,
        usedAt: campaign.experiment.updatedAt,
      });
    }
    for (const section of campaign.sections) {
      for (const key of ["imageUrl", "videoUrl"]) {
        add({
          mediaUrl: contentUrl(section.content, key),
          mediaType: key === "videoUrl" ? "VIDEO" : "IMAGE",
          campaignId: campaign.id,
          campaignName: campaign.name,
          usedAt: section.updatedAt,
        });
      }
    }
  }

  return [...entries.values()]
    .sort((a, b) => {
      const aCurrent = currentCampaignId ? a.campaignIds.includes(currentCampaignId) : false;
      const bCurrent = currentCampaignId ? b.campaignIds.includes(currentCampaignId) : false;
      if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
      return b.lastUsedTimestamp - a.lastUsedTimestamp;
    })
    .map((entry) => ({
      mediaUrl: entry.mediaUrl,
      mediaType: entry.mediaType,
      campaignIds: entry.campaignIds,
      campaignNames: entry.campaignNames,
      label: entry.label,
      lastUsedAt: entry.lastUsedAt,
    }));
}
