"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { retryEmailOutbox } from "@/lib/email-outbox";
import { parseNotificationEmails, saveOperationalSettings, validMetaPixelId } from "@/lib/operational-settings";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string, maximum = 500) {
  return String(formData.get(key) ?? "").trim().slice(0, maximum);
}

function launchRedirect(query: Record<string, string>) {
  redirect(`/admin/spustenie?${new URLSearchParams(query)}`);
}

function integer(formData: FormData, key: string) {
  const value = Number(text(formData, key, 20));
  return Number.isSafeInteger(value) ? value : null;
}

export async function updateOperationalSettings(formData: FormData) {
  const { actor } = await requireAdmin();
  const rawPixelId = text(formData, "metaPixelId", 30);
  const metaPixelId = rawPixelId ? validMetaPixelId(rawPixelId) : null;
  const privacyOperatorName = text(formData, "privacyOperatorName", 200);
  const privacyOperatorAddress = text(formData, "privacyOperatorAddress", 300);
  const privacyContactEmail = text(formData, "privacyContactEmail", 254).toLowerCase();
  const privacyPolicyVersion = text(formData, "privacyPolicyVersion", 50);
  const leadRetentionDays = integer(formData, "leadRetentionDays");
  const campaignBudgetEuros = integer(formData, "maxCampaignDailyBudgetEuros");
  const globalBudgetEuros = integer(formData, "maxGlobalDailyBudgetEuros");
  const metaPixelEnabled = formData.get("metaPixelEnabled") === "on";

  const invalid = rawPixelId && !metaPixelId
    ? "Meta Pixel/Dataset ID musí obsahovať 5 až 30 číslic."
    : metaPixelEnabled && !metaPixelId && !validMetaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID)
      ? "Pixel nemožno zapnúť bez platného ID."
      : !privacyOperatorName || !privacyOperatorAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(privacyContactEmail) || !privacyPolicyVersion
        ? "Doplňte platné firemné a GDPR údaje."
        : leadRetentionDays === null || leadRetentionDays < 30 || leadRetentionDays > 3650
          ? "Retenčná lehota musí byť 30 až 3 650 dní."
          : campaignBudgetEuros === null || campaignBudgetEuros < 5 || campaignBudgetEuros > 10_000
            ? "Limit jednej kampane musí byť od 5 do 10 000 €."
            : globalBudgetEuros === null || globalBudgetEuros < campaignBudgetEuros || globalBudgetEuros > 100_000
              ? "Globálny limit musí byť aspoň limit jednej kampane a najviac 100 000 €."
              : null;
  if (invalid) launchRedirect({ error: invalid, section: "settings" });

  await saveOperationalSettings({
    metaPixelId,
    metaPixelEnabled,
    privacyOperatorName,
    privacyOperatorAddress,
    privacyContactEmail,
    privacyPolicyVersion,
    leadRetentionDays: leadRetentionDays!,
    maxCampaignDailyBudgetCents: campaignBudgetEuros! * 100,
    maxGlobalDailyBudgetCents: globalBudgetEuros! * 100,
  }, actor);
  revalidatePath("/admin/spustenie");
  revalidatePath("/ochrana-osobnych-udajov");
  revalidatePath("/admin/kampane");
  launchRedirect({ saved: "settings" });
}

export async function updateNotificationRecipients(formData: FormData) {
  const { actor } = await requireAdmin();
  const parsed = parseNotificationEmails(text(formData, "notificationEmails", 4000));
  if (parsed.invalid.length > 0 || parsed.valid.length === 0 || parsed.valid.length > 20) {
    launchRedirect({ error: "Zadajte 1 až 20 platných e-mailových adries.", section: "email" });
  }
  await prisma.$transaction(async (tx) => {
    await tx.leadNotificationRecipient.deleteMany({});
    await tx.leadNotificationRecipient.createMany({ data: parsed.valid.map((email) => ({ email, enabled: true })) });
    await tx.operationalSettingAudit.create({ data: { actor, changedFields: ["leadNotificationRecipients"] } });
  });
  revalidatePath("/admin/spustenie");
  launchRedirect({ saved: "recipients" });
}

async function createTestLead(campaignId: string, actor: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true, slug: true, offerType: true } });
  if (!campaign) throw new Error("Vybraná kampaň neexistuje.");
  const unique = randomUUID();
  return prisma.lead.create({
    data: {
      campaignId: campaign.id,
      name: "TEST – Centrum spustenia",
      phone: "+421000000000",
      normalizedPhone: `test-${unique}`,
      interestType: `[TEST] ${campaign.offerType}`.slice(0, 100),
      note: "TEST – syntetický lead vytvorený administrátorom. Nie je to zákaznícka požiadavka.",
      consent: true,
      consentAt: new Date(),
      consentVersion: "TEST",
      dedupeKey: `test-${unique}`,
      campaignSlug: campaign.slug,
      status: "SPAM",
      activities: { create: { type: "CREATED", actor, message: "TEST lead bol vytvorený z Centra spustenia." } },
      emailOutbox: { create: { kind: "ADMIN_NOTIFICATION" } },
    },
    include: { emailOutbox: true },
  });
}

export async function createTestLeadAction(formData: FormData) {
  const { actor } = await requireAdmin();
  const campaignId = text(formData, "campaignId", 100);
  if (!campaignId) launchRedirect({ error: "Vyberte kampaň pre test leadu.", section: "leads" });
  const lead = await createTestLead(campaignId, actor);
  if (lead.emailOutbox.length !== 1) throw new Error("Test lead nevytvoril očakávaný EmailOutbox záznam.");
  revalidatePath("/admin/leady");
  redirect(`/admin/leady/${lead.id}?saved=test-created`);
}

export async function sendTestEmailAction(formData: FormData) {
  const { actor } = await requireAdmin();
  const campaignId = text(formData, "campaignId", 100);
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
    launchRedirect({ error: "Resend API kľúč alebo odosielateľ nie je nastavený v hostingu.", section: "email" });
  }
  const lead = await createTestLead(campaignId, actor);
  const outbox = lead.emailOutbox[0];
  await retryEmailOutbox(outbox.id);
  const result = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: outbox.id }, select: { status: true } });
  revalidatePath("/admin/spustenie");
  launchRedirect(result.status === "SENT" ? { saved: "test-email", testLead: lead.id } : { error: "Testovací e-mail zostal vo failed stave. Skontrolujte Resend doménu a príjemcov.", section: "email", testLead: lead.id });
}

export async function retryFailedEmailsAction() {
  await requireAdmin();
  const failed = await prisma.emailOutbox.findMany({ where: { status: "FAILED" }, select: { id: true }, orderBy: { updatedAt: "asc" }, take: 20 });
  let sent = 0;
  for (const item of failed) {
    const result = await retryEmailOutbox(item.id);
    sent += result.claimed;
  }
  revalidatePath("/admin/spustenie");
  launchRedirect({ saved: "retried", count: String(sent) });
}
