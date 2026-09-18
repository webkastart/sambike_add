import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const cronHealthIds = ["email-outbox", "meta-sync", "campaigns"] as const;
export type CronHealthId = (typeof cronHealthIds)[number];

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "Neznáma chyba")
    .replace(/(token|secret|authorization)[=:]\s*[^\s&,]+/gi, "$1=[redacted]")
    .slice(0, 500);
}

export async function recordCronResult(id: CronHealthId, result: Record<string, unknown>, error?: unknown) {
  const now = new Date();
  return prisma.cronHealth.upsert({
    where: { id },
    create: {
      id,
      lastAttemptAt: now,
      lastSuccessAt: error ? null : now,
      lastFailureAt: error ? now : null,
      lastError: error ? safeError(error) : null,
      lastResult: result as Prisma.InputJsonValue,
    },
    update: {
      lastAttemptAt: now,
      ...(error ? { lastFailureAt: now, lastError: safeError(error) } : { lastSuccessAt: now, lastError: null }),
      lastResult: result as Prisma.InputJsonValue,
    },
  });
}

export function cronHealthState(lastSuccessAt: Date | null | undefined, now = new Date(), maximumAgeHours = 26) {
  if (!lastSuccessAt) return "missing" as const;
  return now.getTime() - lastSuccessAt.getTime() <= maximumAgeHours * 60 * 60 * 1000 ? "healthy" as const : "stale" as const;
}
