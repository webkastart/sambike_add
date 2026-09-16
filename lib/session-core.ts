import { createHmac, timingSafeEqual } from "node:crypto";

export const adminSessionCookie = "sambike_admin_session";
export const adminSessionLifetimeSeconds = 8 * 60 * 60;

type SessionPayload = {
  sub: "admin";
  iat: number;
  exp: number;
  version: 1;
};

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken(secret: string, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const payload: SessionPayload = {
    sub: "admin",
    iat: issuedAt,
    exp: issuedAt + adminSessionLifetimeSeconds,
    version: 1,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, now = Date.now()) {
  if (!token) return false;
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) return false;
  const expectedSignature = signature(encoded, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<SessionPayload>;
    const nowSeconds = Math.floor(now / 1000);
    return payload.sub === "admin"
      && payload.version === 1
      && typeof payload.iat === "number"
      && payload.iat <= nowSeconds + 60
      && typeof payload.exp === "number"
      && payload.exp > nowSeconds;
  } catch {
    return false;
  }
}

export function safeAdminReturnTo(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/admin") || value.startsWith("//")) return "/admin";
  if (/\p{Cc}/u.test(value)) return "/admin";
  try {
    const url = new URL(value, "https://internal.invalid");
    return url.origin === "https://internal.invalid" && url.pathname.startsWith("/admin")
      ? `${url.pathname}${url.search}${url.hash}`
      : "/admin";
  } catch {
    return "/admin";
  }
}
