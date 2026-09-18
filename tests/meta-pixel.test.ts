import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { appSetting: { findUnique: mocks.findUnique, upsert: mocks.upsert } },
}));

import { configuredMetaPixelId, getMetaPixelSettings, setMetaPixelEnabled } from "@/lib/meta-pixel";

describe("Meta Pixel settings", () => {
  const originalPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  beforeEach(() => {
    mocks.findUnique.mockReset().mockResolvedValue(null);
    mocks.upsert.mockReset().mockResolvedValue({ id: "default", metaPixelEnabled: true });
  });

  afterEach(() => {
    if (originalPixelId === undefined) delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    else process.env.NEXT_PUBLIC_META_PIXEL_ID = originalPixelId;
  });

  it("accepts only a numeric configured Pixel ID", () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = " 123456789012345 ";
    expect(configuredMetaPixelId()).toBe("123456789012345");
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "pixel-secret";
    expect(configuredMetaPixelId()).toBeNull();
  });

  it("stays disabled until both the ID and database toggle are present", async () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "123456789012345";
    expect(await getMetaPixelSettings()).toEqual({ configured: true, enabled: false, pixelId: "123456789012345" });

    mocks.findUnique.mockResolvedValueOnce({ id: "default", metaPixelEnabled: true });
    expect((await getMetaPixelSettings()).enabled).toBe(true);

    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    expect(await getMetaPixelSettings()).toEqual({ configured: false, enabled: false, pixelId: null });
  });

  it("persists the global toggle in the singleton settings row", async () => {
    await setMetaPixelEnabled(true);
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { id: "default" },
      create: { id: "default", metaPixelEnabled: true },
      update: { metaPixelEnabled: true },
    });
  });
});
