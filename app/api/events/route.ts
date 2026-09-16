import { isPrismaClientKnownRequestError } from "@/lib/prisma-errors";
import { consumeRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { parseCampaignEventPayload } from "@/lib/campaign-events";

export async function POST(request: Request) {
  if (!(await consumeRateLimit("analytics", 120, 60 * 60 * 1000))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  const event = parseCampaignEventPayload(await request.json().catch(() => null));
  if (!event) {
    return Response.json({ error: "invalid_event" }, { status: 400 });
  }
  const campaign = await prisma.campaign.findFirst({ where: { slug: event.campaignSlug, status: "PUBLISHED" }, select: { id: true } });
  if (!campaign) return Response.json({ error: "campaign_not_found" }, { status: 404 });
  try {
    await prisma.campaignEvent.create({ data: { campaignId: campaign.id, type: event.type, eventId: event.eventId, variant: event.variant } });
  } catch (error) {
    if (!isPrismaClientKnownRequestError(error, "P2002")) throw error;
  }
  return new Response(null, { status: 204 });
}
