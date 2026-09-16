import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { leadProtectionSecret } from "@/lib/security-config";

export async function requestIp() {
  const requestHeaders = await headers();
  return requestHeaders.get("cf-connecting-ip")
    || requestHeaders.get("x-real-ip")
    || requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function requestFingerprint(scope: string, identifier: string) {
  return `${scope}:${createHmac("sha256", leadProtectionSecret()).update(identifier).digest("hex")}`;
}

type BucketRow = { count: number };

export async function consumeRateLimit(scope: string, limit: number, windowMs: number, identifier?: string) {
  const key = requestFingerprint(scope, identifier || await requestIp());
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);
  const [bucket] = await prisma.$queryRaw<BucketRow[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart", "expiresAt", "updatedAt")
    VALUES (${key}, 1, ${now}, ${expiresAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${now} ELSE "RateLimitBucket"."windowStart" END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "RateLimitBucket"."expiresAt" END,
      "updatedAt" = ${now}
    RETURNING "count"
  `;
  return bucket.count <= limit;
}
