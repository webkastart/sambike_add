import { afterEach, describe, expect, it, vi } from "vitest";
import { createRemoteMetaAd } from "@/lib/meta-ads";

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

afterEach(() => {
  process.env = { ...originalEnv };
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("Meta video creatives", () => {
  it("uploads an MP4 and creates a paused ad with video_data", async () => {
    process.env.META_MODE = "live";
    process.env.META_ACCESS_TOKEN = "test-token";
    process.env.META_AD_ACCOUNT_ID = "123";
    process.env.META_PAGE_ID = "456";
    process.env.META_API_VERSION = "v25.0";
    process.env.APP_URL = "https://sambike.example";
    delete process.env.META_APP_SECRET;
    delete process.env.META_INSTAGRAM_ACTOR_ID;

    const responseIds = ["campaign-1", "adset-1", "video-1", "creative-1", "ad-1"];
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ id: responseIds.shift() }));
    global.fetch = fetchMock;

    const result = await createRemoteMetaAd(
      { name: "Servis bicyklov", slug: "servis", fallbackImageUrl: "/uploads/hero.webp" },
      {
        primaryText: "Objednajte si servis bicykla.",
        headline: "Servis bicyklov",
        description: "Rýchlo a spoľahlivo",
        dailyBudgetCents: 1_000,
        radiusKm: 30,
        minAge: 18,
        maxAge: 65,
        platforms: ["facebook"],
        creativeMediaType: "VIDEO",
        creativeMediaUrl: "/uploads/spot.mp4",
        startsAt: null,
        endsAt: null,
      },
    );

    expect(result).toMatchObject({
      metaCampaignId: "campaign-1",
      metaAdSetId: "adset-1",
      metaCreativeId: "creative-1",
      metaAdId: "ad-1",
    });

    const videoCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/act_123/advideos"));
    expect(videoCall).toBeDefined();
    const videoParams = videoCall?.[1]?.body as URLSearchParams;
    expect(videoParams.get("file_url")).toBe("https://sambike.example/uploads/spot.mp4");

    const creativeCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/act_123/adcreatives"));
    expect(creativeCall).toBeDefined();
    const creativeParams = creativeCall?.[1]?.body as URLSearchParams;
    const storySpec = JSON.parse(creativeParams.get("object_story_spec") ?? "{}") as Record<string, unknown>;
    expect(storySpec).toMatchObject({
      page_id: "456",
      video_data: {
        video_id: "video-1",
        image_url: "https://sambike.example/uploads/hero.webp",
        title: "Servis bicyklov",
        call_to_action: {
          type: "LEARN_MORE",
          value: { link: "https://sambike.example/kampan/servis?utm_source=meta&utm_medium=paid_social&utm_campaign=servis" },
        },
      },
    });
    expect(storySpec).not.toHaveProperty("link_data");

    const adCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/act_123/ads"));
    const adParams = adCall?.[1]?.body as URLSearchParams;
    expect(adParams.get("status")).toBe("PAUSED");
  });
});
