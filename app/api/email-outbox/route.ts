import { hasValidCronAuthorization } from "@/lib/cron-auth";
import { processEmailOutbox } from "@/lib/email-outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasValidCronAuthorization(request)) {
    return Response.json({ error: "Neautorizovaná požiadavka." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const result = await processEmailOutbox(20);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
