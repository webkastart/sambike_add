import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/email-outbox", () => ({ retryEmailOutbox: vi.fn() }));
vi.mock("@/lib/operational-settings", () => ({
  parseNotificationEmails: vi.fn(), saveOperationalSettings: vi.fn(), validMetaPixelId: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { createTestLeadAction, retryFailedEmailsAction, sendTestEmailAction, updateNotificationRecipients, updateOperationalSettings } from "@/app/launch-actions";

describe("launch center mutation authorization", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset().mockImplementation(() => { throw new Error("Neautorizovaný prístup."); });
  });

  it("guards every launch mutation before touching inputs or persistence", async () => {
    const form = new FormData();
    for (const action of [updateOperationalSettings, updateNotificationRecipients, createTestLeadAction, sendTestEmailAction]) {
      let failure: unknown;
      try { await action(form); } catch (error) { failure = error; }
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toContain("Neautorizovaný");
    }
    let failure: unknown;
    try { await retryFailedEmailsAction(); } catch (error) { failure = error; }
    expect((failure as Error).message).toContain("Neautorizovaný");
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(5);
  });
});
