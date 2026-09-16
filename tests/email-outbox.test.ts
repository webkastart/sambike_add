import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  sendLeadNotification: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { emailOutbox: { updateMany: mocks.updateMany, findUniqueOrThrow: mocks.findUniqueOrThrow, findUnique: mocks.findUnique, update: mocks.update } } }));
vi.mock("@/lib/email", () => ({ sendLeadNotification: mocks.sendLeadNotification, sendLeadConfirmation: vi.fn() }));

import { retryEmailOutbox } from "@/lib/email-outbox";

describe("email outbox retry", () => {
  beforeEach(() => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue({ id: "outbox-1", leadId: "lead-1", kind: "ADMIN_NOTIFICATION", attempts: 2 });
    mocks.findUnique.mockResolvedValue({
      id: "outbox-1", status: "PROCESSING", lead: {
        id: "lead-1", name: "Ján", phone: "+421900000000", email: null, interestType: "Servis", note: null, createdAt: new Date(),
        campaign: { name: "Servis", slug: "servis", email: "shop@example.com", phone: "+421900000000" },
      },
    });
    mocks.sendLeadNotification.mockResolvedValue({ sent: true, emailId: "email-1" });
    mocks.update.mockResolvedValue({});
  });

  it("claims a failed item and marks it sent", async () => {
    await expect(retryEmailOutbox("outbox-1")).resolves.toEqual({ claimed: 1 });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "outbox-1" },
      data: expect.objectContaining({ status: "SENT", providerMessageId: "email-1" }),
    }));
  });
});
