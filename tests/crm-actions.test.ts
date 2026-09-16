import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  leadFindUnique: vi.fn(),
  leadUpdate: vi.fn(),
  activityCreate: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/email-outbox", () => ({ retryEmailOutbox: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  lead: { findUnique: mocks.leadFindUnique, update: mocks.leadUpdate },
  leadActivity: { create: mocks.activityCreate },
  emailOutbox: { findUniqueOrThrow: vi.fn() },
  $transaction: mocks.transaction,
} }));

import { addLeadNote, updateLeadFollowUp, updateLeadStatus } from "@/app/crm-actions";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function lead(status: "NEW" | "CONTACTED" | "BOOKED" | "COMPLETED" | "LOST" | "SPAM") {
  return {
    id: "lead-1",
    status,
    firstContactedAt: null,
    bookedAt: null,
    completedAt: null,
    completedValueCents: null,
  };
}

describe("autorizované CRM mutácie", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset().mockResolvedValue({ actor: "Administrátor" });
    mocks.leadFindUnique.mockReset();
    mocks.leadUpdate.mockReset().mockReturnValue({ operation: "lead.update" });
    mocks.activityCreate.mockReset().mockReturnValue({ operation: "activity.create" });
    mocks.transaction.mockReset().mockResolvedValue([]);
    mocks.revalidatePath.mockReset();
  });

  it("nepovolí internú poznámku bez admin relácie", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("Neautorizovaný prístup."));
    await expect(addLeadNote("lead-1", form({ note: "Zavolať zajtra" }))).rejects.toThrow("Neautorizovaný");
    expect(mocks.activityCreate).not.toHaveBeenCalled();
  });

  it("pridá poznámku ako nový nemenný auditný záznam", async () => {
    await expect(addLeadNote("lead-1", form({ note: "Zavolať zajtra" }))).rejects.toThrow("REDIRECT:/admin/leady/lead-1?saved=1");
    expect(mocks.activityCreate).toHaveBeenCalledWith({ data: {
      leadId: "lead-1", type: "NOTE_ADDED", actor: "Administrátor", message: "Zavolať zajtra",
    } });
  });

  it("pri zmene stavu zapíše pôvodný stav, nový stav a aktéra", async () => {
    mocks.leadFindUnique.mockResolvedValueOnce(lead("NEW"));
    await expect(updateLeadStatus("lead-1", form({ status: "CONTACTED" }))).rejects.toThrow("saved=1");
    expect(mocks.leadUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "lead-1" }, data: expect.objectContaining({ status: "CONTACTED", firstContactedAt: expect.any(Date) }),
    }));
    expect(mocks.activityCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      leadId: "lead-1", type: "STATUS_CHANGED", actor: "Administrátor", fromStatus: "NEW", toStatus: "CONTACTED",
    }) });
  });

  it("uloží dôvod straty a hodnotu dokončenej zákazky iba v centoch", async () => {
    mocks.leadFindUnique.mockResolvedValueOnce(lead("CONTACTED"));
    await expect(updateLeadStatus("lead-1", form({ status: "LOST", lostReason: "Nedostupný termín" }))).rejects.toThrow("saved=1");
    expect(mocks.leadUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({
      status: "LOST", lostReason: "Nedostupný termín", closedAt: expect.any(Date),
    }) }));

    mocks.leadFindUnique.mockResolvedValueOnce(lead("BOOKED"));
    await expect(updateLeadStatus("lead-1", form({ status: "COMPLETED", completedValue: "129,90" }))).rejects.toThrow("saved=1");
    expect(mocks.leadUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({
      status: "COMPLETED", completedValueCents: 12990, completedValueCurrency: "EUR", completedAt: expect.any(Date),
    }) }));
  });

  it("uloží bratislavský follow-up a vytvorí aktivitu; prázdna hodnota ho vybaví", async () => {
    await expect(updateLeadFollowUp("lead-1", form({ nextFollowUpAt: "2026-07-15T10:30" }))).rejects.toThrow("saved=1");
    expect(mocks.leadUpdate).toHaveBeenLastCalledWith({ where: { id: "lead-1" }, data: { nextFollowUpAt: new Date("2026-07-15T08:30:00.000Z") } });
    expect(mocks.activityCreate).toHaveBeenLastCalledWith({ data: expect.objectContaining({ type: "FOLLOW_UP_CHANGED", actor: "Administrátor" }) });

    await expect(updateLeadFollowUp("lead-1", form({ nextFollowUpAt: "" }))).rejects.toThrow("saved=1");
    expect(mocks.leadUpdate).toHaveBeenLastCalledWith({ where: { id: "lead-1" }, data: { nextFollowUpAt: null } });
    expect(mocks.activityCreate).toHaveBeenLastCalledWith({ data: expect.objectContaining({ message: "Follow-up bol označený ako vybavený." }) });
  });
});
