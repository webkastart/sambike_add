// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CampaignTracking } from "@/components/campaign-tracking";
import { marketingConsentCookie, parseMarketingConsent } from "@/lib/consent";
import { trackMetaEvent } from "@/lib/analytics";

vi.mock("next/script", () => ({ default: (props: React.ComponentProps<"script">) => <script data-testid="meta-pixel" {...props} /> }));

describe("marketing consent", () => {
  beforeEach(() => {
    document.cookie = "sambike_marketing_consent=; Path=/; Max-Age=0";
    window.sessionStorage.clear();
    delete window.fbq;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("does not load Meta Pixel before consent", async () => {
    render(<CampaignTracking campaignSlug="servis" pixelId="123456" />);
    expect(screen.queryByTestId("meta-pixel")).toBeNull();
    expect(await screen.findByText("Povoliť marketing")).toBeTruthy();
  });

  it("does not show marketing controls when Meta Pixel is disabled", async () => {
    render(<CampaignTracking campaignSlug="servis" />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByTestId("meta-pixel")).toBeNull();
    expect(screen.queryByText("Povoliť marketing")).toBeNull();
    expect(screen.queryByText("Nastavenie cookies")).toBeNull();
  });

  it("loads Meta Pixel only after a stored grant", async () => {
    document.cookie = marketingConsentCookie("granted", false);
    render(<CampaignTracking campaignSlug="servis" pixelId="123456" />);
    await waitFor(() => expect(screen.getByTestId("meta-pixel")).toBeTruthy());
    expect(parseMarketingConsent(document.cookie)).toBe("granted");
  });

  it("sends PageView after consent without duplicating it", async () => {
    window.fbq = vi.fn();
    render(<CampaignTracking campaignSlug="servis" pixelId="123456" />);
    (await screen.findByText("Povoliť marketing")).click();
    await waitFor(() => expect(window.fbq).toHaveBeenCalledWith("track", "PageView", expect.objectContaining({ campaign_slug: "servis" })));
    expect(window.fbq).toHaveBeenCalledTimes(1);
  });

  it("deduplicates the Meta Lead event by submission", () => {
    document.cookie = marketingConsentCookie("granted", false);
    window.fbq = vi.fn();
    const parameters = { campaign_slug: "servis", event_id: "lead:submission-1" };
    trackMetaEvent("Lead", parameters);
    trackMetaEvent("Lead", parameters);
    expect(window.fbq).toHaveBeenCalledTimes(1);
  });
});
