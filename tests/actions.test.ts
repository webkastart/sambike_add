import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLeadFormToken } from "@/lib/lead-protection";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  campaignFindUnique: vi.fn(),
  leadFindFirst: vi.fn(),
  leadCreate: vi.fn(),
  processEmailOutbox: vi.fn(),
  consumeRateLimit: vi.fn(),
  verifyTurnstile: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/email-outbox", () => ({ processEmailOutbox: mocks.processEmailOutbox }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.consumeRateLimit, requestIp: vi.fn().mockResolvedValue("127.0.0.1") }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: mocks.verifyTurnstile }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findUnique: mocks.campaignFindUnique },
    lead: { findFirst: mocks.leadFindFirst },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({ lead: { create: mocks.leadCreate } })),
  },
}));

import { changeCampaignStatus, createCampaign, createLead, duplicateCampaign, publishCampaign, scheduleCampaign } from "@/app/actions";

function leadForm() {
  const form = new FormData();
  Object.entries({
    campaignId: "campaign-1",
    campaignSlug: "servis",
    name: "Ján Novák",
    phone: "0904 123 456",
    email: "jan@example.com",
    note: "Servis bŕzd",
    consent: "on",
    website: "",
    submissionId: "12345678-abcd",
    formToken: createLeadFormToken("campaign-1", Date.now() - 4000),
    "cf-turnstile-response": "turnstile-token",
  }).forEach(([key, value]) => form.set(key, value));
  return form;
}

describe("server action security and lead submission", () => {
  beforeEach(() => {
    process.env.LEAD_PROTECTION_SECRET = "lead-test-secret-with-at-least-32-characters";
    mocks.requireAdmin.mockReset().mockResolvedValue({ actor: "Administrátor" });
    mocks.campaignFindUnique.mockReset().mockResolvedValue({ id: "campaign-1", slug: "servis", name: "Servis", offerType: "Servis", email: "shop@example.com", phone: "+421900000000", status: "PUBLISHED", formEnabled: true });
    mocks.leadFindFirst.mockReset().mockResolvedValue(null);
    mocks.leadCreate.mockReset().mockResolvedValue({ id: "lead-1" });
    mocks.processEmailOutbox.mockReset().mockResolvedValue({ claimed: 2 });
    mocks.consumeRateLimit.mockReset().mockResolvedValue(true);
    mocks.verifyTurnstile.mockReset().mockResolvedValue(true);
  });

  it("rejects an admin mutation without a session", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("Neautorizovaný prístup."));
    await expect(createCampaign(new FormData())).rejects.toThrow("Neautorizovaný");
    expect(mocks.campaignFindUnique).not.toHaveBeenCalled();
  });

  it("authorizes publish, archive, duplicate and schedule on the server", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Neautorizovaný prístup."));
    await expect(publishCampaign("campaign-1")).rejects.toThrow("Neautorizovaný");
    await expect(changeCampaignStatus("campaign-1", "ARCHIVED")).rejects.toThrow("Neautorizovaný");
    await expect(duplicateCampaign("campaign-1")).rejects.toThrow("Neautorizovaný");
    await expect(scheduleCampaign("campaign-1", new FormData())).rejects.toThrow("Neautorizovaný");
  });

  it("stores a valid lead and creates outbox records", async () => {
    const result = await createLead({ success: false, message: "" }, leadForm());
    expect(result.success).toBe(true);
    expect(mocks.leadCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "Ján Novák",
        normalizedPhone: "+421904123456",
        consent: true,
        emailOutbox: { create: [{ kind: "ADMIN_NOTIFICATION" }, { kind: "CUSTOMER_CONFIRMATION" }] },
      }),
    }));
    expect(mocks.processEmailOutbox).toHaveBeenCalled();
  });

  it("silently accepts honeypot spam without writing", async () => {
    const form = leadForm();
    form.set("website", "https://spam.invalid");
    const result = await createLead({ success: false, message: "" }, form);
    expect(result.success).toBe(true);
    expect(mocks.campaignFindUnique).not.toHaveBeenCalled();
  });

  it("returns a Slovak error for invalid data and rate limits", async () => {
    const invalid = leadForm();
    invalid.set("phone", "x");
    expect((await createLead({ success: false, message: "" }, invalid)).success).toBe(false);
    mocks.consumeRateLimit.mockResolvedValueOnce(false);
    expect((await createLead({ success: false, message: "" }, leadForm())).message).toContain("Príliš veľa");
  });

  it("deduplicates a repeated submission", async () => {
    mocks.leadCreate.mockRejectedValueOnce({ code: "P2002" });
    const result = await createLead({ success: false, message: "" }, leadForm());
    expect(result).toEqual({ success: true, message: "Požiadavku už evidujeme. Čoskoro sa vám ozveme." });
  });
});
