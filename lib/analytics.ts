"use client";

import { parseMarketingConsent } from "@/lib/consent";

export type AnalyticsEvent = "PageView" | "CTA click" | "Phone click" | "Form start" | "Lead";

export type Attribution = {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  landingPage: string;
  referrer: string;
};

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const storagePrefix = "sambike.attribution.";
const utmFields = {
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  utmContent: "utm_content",
  utmTerm: "utm_term",
} as const;

function readStorage(key: string) {
  try {
    return window.sessionStorage.getItem(`${storagePrefix}${key}`) ?? "";
  } catch {
    return "";
  }
}

function writeStorage(key: string, value: string) {
  if (!value) return;
  try {
    window.sessionStorage.setItem(`${storagePrefix}${key}`, value);
  } catch {
    // Atribúcia nesmie zablokovať formulár, ak prehliadač blokuje sessionStorage.
  }
}

export function readAttribution(campaignSlug: string): Attribution {
  const params = new URLSearchParams(window.location.search);

  for (const [field, parameter] of Object.entries(utmFields)) {
    const value = params.get(parameter)?.trim().slice(0, 255) ?? "";
    if (value) writeStorage(field, value);
  }

  if (!readStorage("landingPage")) {
    writeStorage("landingPage", `${window.location.pathname}${window.location.search}`.slice(0, 2000));
  }
  if (!readStorage("referrer") && document.referrer) {
    writeStorage("referrer", document.referrer.slice(0, 2000));
  }
  writeStorage("campaignSlug", campaignSlug);

  return {
    utmSource: readStorage("utmSource"),
    utmMedium: readStorage("utmMedium"),
    utmCampaign: readStorage("utmCampaign"),
    utmContent: readStorage("utmContent"),
    utmTerm: readStorage("utmTerm"),
    landingPage: readStorage("landingPage"),
    referrer: readStorage("referrer"),
  };
}

export function trackEvent(event: AnalyticsEvent, parameters: Record<string, string> = {}) {
  window.dispatchEvent(new CustomEvent("sambike:analytics", { detail: { event, ...parameters } }));

  const internalTypes: Partial<Record<AnalyticsEvent, string>> = {
    "PageView": "PAGE_VIEW",
    "CTA click": "CTA_CLICK",
    "Phone click": "PHONE_CLICK",
    "Form start": "FORM_START",
  };
  const internalType = internalTypes[event];
  if (internalType && parameters.campaign_slug) {
    const eventId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignSlug: parameters.campaign_slug, type: internalType, eventId, variant: parameters.variant }),
      keepalive: true,
    }).catch(() => undefined);
  }

  trackMetaEvent(event, parameters);
}

export function trackMetaEvent(event: AnalyticsEvent, parameters: Record<string, string> = {}) {
  if (!window.fbq || parseMarketingConsent(document.cookie) !== "granted") return;
  if (event === "PageView" || event === "Lead") {
    const identity = parameters.event_id || `${event}:${parameters.campaign_slug || window.location.pathname}`;
    const key = `${storagePrefix}meta.${identity}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "sent");
    } catch {
      // Deduplikácia v rámci komponentu zostáva aktívna aj bez sessionStorage.
    }
  }
  if (event === "PageView" || event === "Lead") {
    window.fbq("track", event, parameters);
  } else {
    window.fbq("trackCustom", event.replaceAll(" ", "_"), parameters);
  }
}
