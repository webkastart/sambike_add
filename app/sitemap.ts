import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL?.trim();
  if (!base) return [];
  let origin: URL;
  try { origin = new URL(base); } catch { return []; }
  const campaigns = await prisma.campaign.findMany({ where: { status: "PUBLISHED", noIndex: false }, select: { slug: true, canonicalUrl: true, updatedAt: true } });
  return campaigns.map((campaign) => ({
    url: campaign.canonicalUrl || new URL(`/kampan/${campaign.slug}`, origin).toString(),
    lastModified: campaign.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
}
