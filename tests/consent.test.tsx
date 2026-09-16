// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CampaignTracking } from "@/components/campaign-tracking";
import { marketingConsentCookie, parseMarketingConsent } from "@/lib/consent";

vi.mock("next/script", () => ({ default: (props: React.ComponentProps<"script">) => <script data-testid="meta-pixel" {...props} /> }));

describe("marketing consent", () => {
  beforeEach(() => {
    document.cookie = "sambike_marketing_consent=; Path=/; Max-Age=0";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("does not load Meta Pixel before consent", async () => {
    render(<CampaignTracking campaignSlug="servis" pixelId="123456" />);
    expect(screen.queryByTestId("meta-pixel")).toBeNull();
    expect(await screen.findByText("Povoliť marketing")).toBeTruthy();
  });

  it("loads Meta Pixel only after a stored grant", async () => {
    document.cookie = marketingConsentCookie("granted", false);
    render(<CampaignTracking campaignSlug="servis" pixelId="123456" />);
    await waitFor(() => expect(screen.getByTestId("meta-pixel")).toBeTruthy());
    expect(parseMarketingConsent(document.cookie)).toBe("granted");
  });
});
