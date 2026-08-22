"use client";

import Script from "next/script";
import { useEffect } from "react";
import { readAttribution, trackEvent } from "@/lib/analytics";

export function CampaignTracking({ campaignSlug, pixelId }: { campaignSlug: string; pixelId?: string }) {
  useEffect(() => {
    readAttribution(campaignSlug);

    const pageViewTimer = window.setTimeout(() => {
      trackEvent("PageView", { campaign_slug: campaignSlug });
    }, 0);

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-track]") : null;
      const trackingType = target?.dataset.track;
      if (trackingType === "cta") trackEvent("CTA click", { campaign_slug: campaignSlug });
      if (trackingType === "phone") trackEvent("Phone click", { campaign_slug: campaignSlug });
    };

    document.addEventListener("click", handleClick);
    return () => {
      window.clearTimeout(pageViewTimer);
      document.removeEventListener("click", handleClick);
    };
  }, [campaignSlug]);

  if (!pixelId) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(pixelId)});`}
    </Script>
  );
}
