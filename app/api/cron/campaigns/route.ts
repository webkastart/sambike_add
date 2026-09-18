import { runCampaignSchedule } from "@/lib/campaign-scheduler";
import { hasValidCronAuthorization } from "@/lib/cron-auth";
import { recordCronResult } from "@/lib/cron-health";

export async function POST(request: Request) {
  if (!hasValidCronAuthorization(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const results = await runCampaignSchedule();
    const summary = { processed: results.length, published: results.filter((item) => item.operation === "publish" && item.ok).length, paused: results.filter((item) => item.operation === "unpublish" && item.ok).length, failed: results.filter((item) => !item.ok).length };
    await recordCronResult("campaigns", summary);
    return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await recordCronResult("campaigns", { ok: false }, error).catch(() => undefined);
    return Response.json({ error: "Spracovanie plánovaných kampaní zlyhalo." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
