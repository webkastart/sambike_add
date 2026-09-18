import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { campaign: { findMany: mocks.findMany } } }));

import { getCampaignMediaLibrary } from "@/lib/campaign-media-library";

describe("zdroj knižnice médií", () => {
  beforeEach(() => mocks.findMany.mockReset());

  it("zahrnie všetky platné médiá priradené ku kampani, nielen /uploads/", async () => {
    const usedAt = new Date("2026-09-18T10:00:00.000Z");
    mocks.findMany.mockResolvedValue([{
      id: "campaign-1",
      name: "Servis PC",
      updatedAt: usedAt,
      imageUrl: "/uploads/hero.webp",
      offerImageUrl: "/campaigns/service/offer.png",
      galleryImage1Url: null,
      galleryImage2Url: null,
      galleryImage3Url: null,
      ogImageUrl: "https://cdn.example.com/social.jpg",
      experiment: { variantImageUrl: "/campaigns/service/variant.png", updatedAt: usedAt },
      sections: [
        { content: { imageUrl: "/campaigns/service/detail.png" }, updatedAt: usedAt },
        { content: { videoUrl: "https://cdn.example.com/demo.mp4?version=2" }, updatedAt: usedAt },
      ],
      galleryItems: [{ mediaUrl: "/campaigns/service/gallery.png", mediaType: "IMAGE", caption: "Galéria", createdAt: usedAt }],
    }]);

    const library = await getCampaignMediaLibrary("campaign-1");

    expect(library.map((item) => item.mediaUrl)).toEqual(expect.arrayContaining([
      "/uploads/hero.webp",
      "/campaigns/service/offer.png",
      "https://cdn.example.com/social.jpg",
      "/campaigns/service/variant.png",
      "/campaigns/service/detail.png",
      "https://cdn.example.com/demo.mp4?version=2",
      "/campaigns/service/gallery.png",
    ]));
    expect(library.find((item) => item.mediaUrl.includes("demo.mp4"))?.mediaType).toBe("VIDEO");
  });

  it("ignoruje neplatné a nepodporované adresy", async () => {
    const usedAt = new Date("2026-09-18T10:00:00.000Z");
    mocks.findMany.mockResolvedValue([{
      id: "campaign-1",
      name: "Servis PC",
      updatedAt: usedAt,
      imageUrl: "javascript:alert(1)",
      offerImageUrl: "//cdn.example.com/image.jpg",
      galleryImage1Url: null,
      galleryImage2Url: null,
      galleryImage3Url: null,
      ogImageUrl: null,
      experiment: null,
      sections: [],
      galleryItems: [],
    }]);

    await expect(getCampaignMediaLibrary("campaign-1")).resolves.toEqual([]);
  });
});
