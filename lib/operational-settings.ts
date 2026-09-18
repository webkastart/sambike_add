import "server-only";

import { prisma } from "@/lib/prisma";

const settingsId = "default";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const metaPixelIdPattern = /^\d{5,30}$/;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function validMetaPixelId(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return metaPixelIdPattern.test(normalized) ? normalized : null;
}

export function parseNotificationEmails(value: string) {
  const emails = value.split(/[,;\n]/).map((email) => email.trim().toLowerCase()).filter(Boolean);
  return {
    valid: [...new Set(emails.filter((email) => emailPattern.test(email)))],
    invalid: [...new Set(emails.filter((email) => !emailPattern.test(email)))],
  };
}

export async function getOperationalSettings() {
  const stored = await prisma.appSetting.findUnique({ where: { id: settingsId } });
  const envPixelId = validMetaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);
  const pixelId = validMetaPixelId(stored?.metaPixelId) ?? envPixelId;
  const retentionFallback = positiveInteger(process.env.LEAD_RETENTION_DAYS, 730);
  const campaignBudgetFallback = positiveInteger(process.env.META_MAX_CAMPAIGN_DAILY_BUDGET_CENTS, 5_000);
  const globalBudgetFallback = positiveInteger(process.env.META_MAX_GLOBAL_DAILY_BUDGET_CENTS, 10_000);

  return {
    stored,
    metaPixelId: pixelId,
    metaPixelSource: validMetaPixelId(stored?.metaPixelId) ? "database" as const : envPixelId ? "environment" as const : "missing" as const,
    metaPixelEnabled: Boolean(pixelId && stored?.metaPixelEnabled),
    privacyOperatorName: stored?.privacyOperatorName?.trim() || process.env.PRIVACY_OPERATOR_NAME?.trim() || "",
    privacyOperatorAddress: stored?.privacyOperatorAddress?.trim() || process.env.PRIVACY_OPERATOR_ADDRESS?.trim() || "",
    privacyContactEmail: stored?.privacyContactEmail?.trim() || process.env.PRIVACY_CONTACT_EMAIL?.trim() || "",
    privacyPolicyVersion: stored?.privacyPolicyVersion?.trim() || process.env.PRIVACY_POLICY_VERSION?.trim() || "2026-09-16",
    leadRetentionDays: stored?.leadRetentionDays ?? retentionFallback,
    maxCampaignDailyBudgetCents: stored?.metaMaxCampaignDailyBudgetCents ?? campaignBudgetFallback,
    maxGlobalDailyBudgetCents: stored?.metaMaxGlobalDailyBudgetCents ?? globalBudgetFallback,
  };
}

export async function saveOperationalSettings(input: {
  metaPixelId: string | null;
  metaPixelEnabled: boolean;
  privacyOperatorName: string;
  privacyOperatorAddress: string;
  privacyContactEmail: string;
  privacyPolicyVersion: string;
  leadRetentionDays: number;
  maxCampaignDailyBudgetCents: number;
  maxGlobalDailyBudgetCents: number;
}, actor: string) {
  const previous = await prisma.appSetting.findUnique({ where: { id: settingsId } });
  const data = {
    metaPixelId: input.metaPixelId,
    metaPixelEnabled: input.metaPixelEnabled,
    privacyOperatorName: input.privacyOperatorName,
    privacyOperatorAddress: input.privacyOperatorAddress,
    privacyContactEmail: input.privacyContactEmail,
    privacyPolicyVersion: input.privacyPolicyVersion,
    leadRetentionDays: input.leadRetentionDays,
    metaMaxCampaignDailyBudgetCents: input.maxCampaignDailyBudgetCents,
    metaMaxGlobalDailyBudgetCents: input.maxGlobalDailyBudgetCents,
  };
  const changedFields = Object.entries(data)
    .filter(([key, value]) => previous?.[key as keyof typeof previous] !== value)
    .map(([key]) => key);

  await prisma.$transaction([
    prisma.appSetting.upsert({ where: { id: settingsId }, create: { id: settingsId, ...data }, update: data }),
    ...(changedFields.length > 0 ? [prisma.operationalSettingAudit.create({ data: { actor, changedFields } })] : []),
  ]);
  return changedFields;
}
