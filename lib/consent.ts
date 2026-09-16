export type MarketingConsent = "granted" | "denied" | null;
export const consentCookieName = "sambike_marketing_consent";

export function parseMarketingConsent(cookieHeader: string): MarketingConsent {
  const match = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${consentCookieName}=`));
  const value = match?.slice(consentCookieName.length + 1);
  return value === "granted" || value === "denied" ? value : null;
}

export function marketingConsentCookie(value: Exclude<MarketingConsent, null>, secure: boolean) {
  return `${consentCookieName}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`;
}
