import type { syncRemoteMetaAd } from "@/lib/meta-ads";
import { prisma } from "@/lib/prisma";

export type RemoteMetaSync = Awaited<ReturnType<typeof syncRemoteMetaAd>>;
type DailyMetric = RemoteMetaSync["dailyMetrics"][number];

export function metaDailyMetricUpsert(metaAdCampaignId: string, metric: DailyMetric) {
  return {
    where: { metaAdCampaignId_date: { metaAdCampaignId, date: metric.date } },
    create: { metaAdCampaignId, ...metric },
    update: metric,
  };
}

export async function persistMetaAdSync(metaAdCampaignId: string, remote: RemoteMetaSync) {
  const { dailyMetrics, ...summary } = remote;
  await prisma.$transaction([
    prisma.metaAdCampaign.update({
      where: { id: metaAdCampaignId },
      data: { ...summary, lastSyncedAt: new Date(), lastError: null },
    }),
    ...dailyMetrics.map((metric) => prisma.metaDailyMetric.upsert(metaDailyMetricUpsert(metaAdCampaignId, metric))),
  ]);
}
