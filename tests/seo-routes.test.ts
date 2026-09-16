import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { campaign: { findMany: mocks.findMany } } }));

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("SEO route policy", () => {
  beforeEach(() => {
    process.env.APP_URL = "https://kampane.sambike.sk";
    mocks.findMany.mockReset().mockResolvedValue([{ slug: "servis", canonicalUrl: null, updatedAt: new Date("2026-09-16T10:00:00Z") }]);
  });
  afterEach(() => { delete process.env.APP_URL; });

  it("includes only published indexable campaigns in sitemap", async () => {
    expect(await sitemap()).toEqual([expect.objectContaining({ url: "https://kampane.sambike.sk/kampan/servis" })]);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "PUBLISHED", noIndex: false } }));
  });

  it("blocks administration, APIs and preview URLs from robots", () => {
    const result = robots();
    expect(result.rules).toEqual(expect.objectContaining({ disallow: expect.arrayContaining(["/admin/", "/api/", "/*?preview="]) }));
    expect(result.sitemap).toBe("https://kampane.sambike.sk/sitemap.xml");
  });
});
