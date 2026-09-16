import { createHmac, timingSafeEqual } from "node:crypto";

export function hasValidCronAuthorization(request: Request) {
  const configured = process.env.CRON_SECRET?.trim();
  if (!configured || (process.env.NODE_ENV === "production" && configured.length < 32)) return false;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const expectedDigest = createHmac("sha256", configured).update(configured).digest();
  const suppliedDigest = createHmac("sha256", configured).update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}
