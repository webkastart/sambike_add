import { describe, expect, it } from "vitest";
import { adminSessionLifetimeSeconds, createSessionToken, safeAdminReturnTo, verifySessionToken } from "@/lib/session-core";

describe("admin session", () => {
  const secret = "a-secure-test-secret-with-more-than-32-characters";
  const now = Date.UTC(2026, 8, 16);

  it("keeps new admin sessions valid for 90 days", () => {
    expect(adminSessionLifetimeSeconds).toBe(90 * 24 * 60 * 60);
    expect(verifySessionToken(createSessionToken(secret, now), secret, now + (90 * 24 * 60 * 60 - 1) * 1000)).toBe(true);
  });

  it("creates and verifies a signed session", () => {
    expect(verifySessionToken(createSessionToken(secret, now), secret, now + 1000)).toBe(true);
  });

  it("rejects expired and modified sessions", () => {
    const token = createSessionToken(secret, now);
    expect(verifySessionToken(token, secret, now + (adminSessionLifetimeSeconds + 1) * 1000)).toBe(false);
    expect(verifySessionToken(`${token.slice(0, -1)}x`, secret, now)).toBe(false);
  });

  it("only returns safe internal admin URLs", () => {
    expect(safeAdminReturnTo("/admin/leady?stav=NEW")).toBe("/admin/leady?stav=NEW");
    expect(safeAdminReturnTo("https://evil.example/admin")).toBe("/admin");
    expect(safeAdminReturnTo("//evil.example/admin")).toBe("/admin");
    expect(safeAdminReturnTo("/kampan/servis")).toBe("/admin");
  });
});
