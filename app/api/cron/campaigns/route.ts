import { runCampaignSchedule } from "@/lib/campaign-scheduler";
import { hasValidCronAuthorization } from "@/lib/cron-auth";

export async function POST(request: Request) {
  if (!hasValidCronAuthorization(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const results = await runCampaignSchedule();
  return Response.json({ processed: results.length, published: results.filter((item) => item.operation === "publish" && item.ok).length, paused: results.filter((item) => item.operation === "unpublish" && item.ok).length, failed: results.filter((item) => !item.ok).length }, { headers: { "Cache-Control": "no-store" } });
}
