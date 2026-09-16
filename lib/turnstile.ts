import "server-only";

import { ConfigurationError } from "@/lib/security-config";

type TurnstileResponse = { success?: boolean; "error-codes"?: string[] };

export async function verifyTurnstile(token: string, remoteIp: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (!secret || !siteKey) {
    if (process.env.NODE_ENV === "production") {
      throw new ConfigurationError("V produkcii chýba konfigurácia Cloudflare Turnstile.");
    }
    return true;
  }
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp !== "unknown") body.set("remoteip", remoteIp);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) return false;
    const result = await response.json() as TurnstileResponse;
    return result.success === true;
  } catch {
    return false;
  }
}
