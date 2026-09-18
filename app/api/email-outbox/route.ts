import { hasValidCronAuthorization } from "@/lib/cron-auth";
import { processEmailOutbox } from "@/lib/email-outbox";
import { recordCronResult } from "@/lib/cron-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasValidCronAuthorization(request)) {
    return Response.json({ error: "Neautorizovaná požiadavka." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const result = await processEmailOutbox(20);
    await recordCronResult("email-outbox", result);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await recordCronResult("email-outbox", { ok: false }, error).catch(() => undefined);
    return Response.json({ error: "Spracovanie e-mailového outboxu zlyhalo." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
