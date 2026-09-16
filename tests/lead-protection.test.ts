import { beforeEach, describe, expect, it } from "vitest";
import { createLeadFormToken, leadDedupeKey, verifyLeadFormToken } from "@/lib/lead-protection";

describe("lead form protection", () => {
  beforeEach(() => { process.env.LEAD_PROTECTION_SECRET = "lead-test-secret-with-at-least-32-characters"; });
  const now = Date.UTC(2026, 8, 16);

  it("rejects submissions that are too fast and accepts aged tokens", () => {
    const token = createLeadFormToken("campaign", now);
    expect(verifyLeadFormToken(token, "campaign", now + 1000)).toMatchObject({ valid: false, reason: "too_fast" });
    expect(verifyLeadFormToken(token, "campaign", now + 4000).valid).toBe(true);
  });

  it("rejects tampering and creates stable dedupe keys", () => {
    const token = createLeadFormToken("campaign", now);
    expect(verifyLeadFormToken(`${token}x`, "campaign", now + 4000).valid).toBe(false);
    expect(leadDedupeKey("campaign", "nonce", "payload")).toBe(leadDedupeKey("campaign", "nonce", "payload"));
  });
});
