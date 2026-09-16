import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  campaignFindFirst: vi.fn(),
  eventCreate: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.consumeRateLimit }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  campaign: { findFirst: mocks.campaignFindFirst },
  campaignEvent: { create: mocks.eventCreate },
} }));

import { POST } from "@/app/api/events/route";

function request(body: unknown) {
  return new Request("https://example.com/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("interný analytics endpoint", () => {
  beforeEach(() => {
    mocks.consumeRateLimit.mockReset().mockResolvedValue(true);
    mocks.campaignFindFirst.mockReset().mockResolvedValue({ id: "campaign-1" });
    mocks.eventCreate.mockReset().mockResolvedValue({ id: "event-1" });
  });

  it("zapíše iba povolenú udalosť aktívnej kampane", async () => {
    const response = await POST(request({ campaignSlug: "servis", type: "CTA_CLICK", eventId: "event_123456" }));
    expect(response.status).toBe(204);
    expect(mocks.campaignFindFirst).toHaveBeenCalledWith({ where: { slug: "servis", status: "PUBLISHED" }, select: { id: true } });
    expect(mocks.eventCreate).toHaveBeenCalledWith({ data: { campaignId: "campaign-1", type: "CTA_CLICK", eventId: "event_123456", variant: null } });
  });

  it("považuje retry rovnakého eventId za úspešný bez druhého záznamu", async () => {
    mocks.eventCreate.mockRejectedValueOnce({ code: "P2002" });
    const response = await POST(request({ campaignSlug: "servis", type: "PAGE_VIEW", eventId: "event_123456" }));
    expect(response.status).toBe(204);
  });

  it("odmietne neplatný payload a zahltenie", async () => {
    expect((await POST(request({ campaignSlug: "servis", type: "DELETE_ALL", eventId: "event_123456" }))).status).toBe(400);
    mocks.consumeRateLimit.mockResolvedValueOnce(false);
    expect((await POST(request({ campaignSlug: "servis", type: "PAGE_VIEW", eventId: "event_123456" }))).status).toBe(429);
  });
});
