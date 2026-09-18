import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { cronHealth: { upsert: vi.fn() } } }));

import { cronHealthState } from "@/lib/cron-health";

describe("cron health", () => {
  const now = new Date("2026-09-18T12:00:00.000Z");

  it("distinguishes missing, current and stale successful runs", () => {
    expect(cronHealthState(null, now)).toBe("missing");
    expect(cronHealthState(new Date("2026-09-18T11:00:00.000Z"), now)).toBe("healthy");
    expect(cronHealthState(new Date("2026-09-16T00:00:00.000Z"), now)).toBe("stale");
  });
});
