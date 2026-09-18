import { syncRemoteMetaAd } from "@/lib/meta-ads";
import { prisma } from "@/lib/prisma";
import { hasValidCronAuthorization } from "@/lib/cron-auth";
import { persistMetaAdSync } from "@/lib/meta-sync";
import { recordCronResult } from "@/lib/cron-health";

export async function POST(request: Request) {
  if (!hasValidCronAuthorization(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const ads = await prisma.metaAdCampaign.findMany({ where: { metaCampaignId: { not: null } }, select: { id: true, metaCampaignId: true } });
    const results = [];
    for (const ad of ads) {
      try {
        const remote = await syncRemoteMetaAd(ad.metaCampaignId!);
        await persistMetaAdSync(ad.id, remote);
        results.push({ id: ad.id, ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : "Synchronizácia zlyhala.";
        await prisma.metaAdCampaign.update({ where: { id: ad.id }, data: { lastError: message } });
        results.push({ id: ad.id, ok: false });
      }
    }
    const summary = { synced: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length };
    await recordCronResult("meta-sync", summary);
    return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await recordCronResult("meta-sync", { ok: false }, error).catch(() => undefined);
    return Response.json({ error: "Synchronizácia Meta reklám zlyhala." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
