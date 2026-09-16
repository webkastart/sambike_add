import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { leadProtectionSecret } from "@/lib/security-config";

const minimumFormSeconds = 3;
const maximumFormSeconds = 2 * 60 * 60;

type FormTokenPayload = { campaignId: string; issuedAt: number; nonce: string };

function sign(value: string) {
  return createHmac("sha256", leadProtectionSecret()).update(value).digest("base64url");
}

export function createLeadFormToken(campaignId: string, now = Date.now()) {
  const payload: FormTokenPayload = {
    campaignId,
    issuedAt: Math.floor(now / 1000),
    nonce: randomBytes(12).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyLeadFormToken(token: string, campaignId: string, now = Date.now()) {
  const [encoded, provided, extra] = token.split(".");
  if (!encoded || !provided || extra) return { valid: false as const, reason: "invalid" as const };
  const expected = Buffer.from(sign(encoded));
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { valid: false as const, reason: "invalid" as const };
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<FormTokenPayload>;
    const age = Math.floor(now / 1000) - Number(payload.issuedAt);
    if (payload.campaignId !== campaignId || typeof payload.nonce !== "string" || age < 0 || age > maximumFormSeconds) {
      return { valid: false as const, reason: "invalid" as const };
    }
    if (age < minimumFormSeconds) return { valid: false as const, reason: "too_fast" as const };
    return { valid: true as const, nonce: payload.nonce };
  } catch {
    return { valid: false as const, reason: "invalid" as const };
  }
}

export function leadDedupeKey(campaignId: string, nonce: string, normalizedPayload: string) {
  return createHmac("sha256", leadProtectionSecret())
    .update(`${campaignId}:${nonce}:${normalizedPayload}`)
    .digest("hex");
}
