"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { readAttribution, trackEvent } from "@/lib/analytics";
import { marketingConsentCookie, parseMarketingConsent, type MarketingConsent } from "@/lib/consent";

export function CampaignTracking({ campaignSlug, pixelId, variant = "A" }: { campaignSlug: string; pixelId?: string; variant?: "A" | "B" }) {
  const [consent, setConsent] = useState<MarketingConsent>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const consentTimer = window.setTimeout(() => setConsent(parseMarketingConsent(document.cookie)), 0);
    readAttribution(campaignSlug);

    const pageViewTimer = window.setTimeout(() => {
      trackEvent("PageView", { campaign_slug: campaignSlug, variant });
    }, 0);

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-track]") : null;
      const trackingType = target?.dataset.track;
      if (trackingType === "cta") trackEvent("CTA click", { campaign_slug: campaignSlug, variant });
      if (trackingType === "phone") trackEvent("Phone click", { campaign_slug: campaignSlug, variant });
    };

    document.addEventListener("click", handleClick);
    return () => {
      window.clearTimeout(consentTimer);
      window.clearTimeout(pageViewTimer);
      document.removeEventListener("click", handleClick);
    };
  }, [campaignSlug, variant]);

  const chooseConsent = (value: Exclude<MarketingConsent, null>) => {
    const wasGranted = consent === "granted";
    document.cookie = marketingConsentCookie(value, window.location.protocol === "https:");
    if (value === "denied") {
      for (const name of ["_fbp", "_fbc"]) document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
    setConsent(value);
    setPreferencesOpen(false);
    if (wasGranted && value === "denied") window.location.reload();
  };

  return (
    <>
      {pixelId && consent === "granted" && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(pixelId)});fbq('track','PageView');`}
        </Script>
      )}
      {pixelId && (consent === null || preferencesOpen) && (
        <aside className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-2xl rounded-lg bg-[var(--ink)] p-4 text-sm text-white shadow-xl" aria-label="Nastavenie analytických cookies">
          <p className="leading-6">Nevyhnutné funkcie a základná atribúcia fungujú bez marketingových cookies. Meta Pixel zapneme iba s vaším súhlasom. <a href="/ochrana-osobnych-udajov" className="underline">Viac informácií</a></p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button className="rounded bg-[var(--accent)] px-4 py-2 font-semibold" type="button" onClick={() => chooseConsent("granted")}>Povoliť marketing</button>
            <button className="px-3 py-2 font-semibold text-white/80" type="button" onClick={() => chooseConsent("denied")}>Iba nevyhnutné</button>
          </div>
        </aside>
      )}
      {pixelId && consent !== null && !preferencesOpen && (
        <button type="button" onClick={() => setPreferencesOpen(true)} className="self-start underline underline-offset-2 transition hover:text-[var(--ink)] sm:self-end">
          Nastavenie cookies
        </button>
      )}
    </>
  );
}
