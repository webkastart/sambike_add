export const publicCampaignEventTypes = ["PAGE_VIEW", "CTA_CLICK", "PHONE_CLICK", "FORM_START"] as const;
export type PublicCampaignEventType = (typeof publicCampaignEventTypes)[number];

export function parseCampaignEventPayload(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.campaignSlug !== "string" || !/^[a-z0-9-]{1,120}$/.test(candidate.campaignSlug)) return null;
  if (typeof candidate.type !== "string" || !publicCampaignEventTypes.includes(candidate.type as PublicCampaignEventType)) return null;
  if (typeof candidate.eventId !== "string" || !/^[a-zA-Z0-9:_-]{8,100}$/.test(candidate.eventId)) return null;
  const variant = candidate.variant === "A" || candidate.variant === "B" ? candidate.variant : null;
  return { campaignSlug: candidate.campaignSlug, type: candidate.type as PublicCampaignEventType, eventId: candidate.eventId, variant };
}
