import "server-only";

import { prisma } from "@/lib/prisma";
import { sendLeadConfirmation, sendLeadNotification } from "@/lib/email";

const maxAttempts = 8;
type ClaimedOutbox = { id: string; leadId: string; kind: "ADMIN_NOTIFICATION" | "CUSTOMER_CONFIRMATION"; attempts: number };

function retryDelay(attempts: number) {
  return Math.min(24 * 60 * 60, 60 * 2 ** Math.max(0, attempts - 1));
}

async function claimOutbox(limit: number) {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 2 * 60 * 1000);
  return prisma.$queryRaw<ClaimedOutbox[]>`
    WITH candidates AS (
      SELECT "id"
      FROM "EmailOutbox"
      WHERE "attempts" < ${maxAttempts}
        AND (
          ("status" IN ('PENDING', 'FAILED') AND "nextAttemptAt" <= ${now})
          OR ("status" = 'PROCESSING' AND "leaseUntil" <= ${now})
        )
      ORDER BY "nextAttemptAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE "EmailOutbox" AS outbox
    SET "status" = 'PROCESSING',
        "attempts" = outbox."attempts" + 1,
        "lastAttemptAt" = ${now},
        "leaseUntil" = ${leaseUntil},
        "updatedAt" = ${now}
    FROM candidates
    WHERE outbox."id" = candidates."id"
    RETURNING outbox."id", outbox."leadId", outbox."kind", outbox."attempts"
  `;
}

async function deliver(item: ClaimedOutbox) {
  const outbox = await prisma.emailOutbox.findUnique({
    where: { id: item.id },
    include: { lead: { include: { campaign: true } } },
  });
  if (!outbox || outbox.status !== "PROCESSING") return;
  const { lead } = outbox;
  const emailData = {
    leadId: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    interestType: lead.interestType,
    note: lead.note,
    campaignName: lead.campaign.name,
    campaignSlug: lead.campaign.slug,
    createdAt: lead.createdAt,
  };
  try {
    const result = item.kind === "ADMIN_NOTIFICATION"
      ? await sendLeadNotification(emailData)
      : await sendLeadConfirmation({
        ...emailData,
        campaignEmail: lead.campaign.email,
        campaignPhone: lead.campaign.phone,
      });
    if (result.sent) {
      await prisma.emailOutbox.update({
        where: { id: item.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: result.emailId,
          lastError: null,
          leaseUntil: null,
        },
      });
      return;
    }
    throw new Error(result.reason === "not_configured" ? "E-mailová služba nie je nakonfigurovaná." : "Poskytovateľ e-mail odmietol.");
  } catch (error) {
    const isFinal = item.attempts >= maxAttempts;
    await prisma.emailOutbox.update({
      where: { id: item.id },
      data: {
        status: "FAILED",
        leaseUntil: null,
        lastError: error instanceof Error ? error.message.slice(0, 300) : "Odoslanie zlyhalo.",
        nextAttemptAt: new Date(Date.now() + retryDelay(item.attempts) * 1000),
      },
    });
    if (isFinal) console.error(`E-mailový outbox ${item.id} vyčerpal počet pokusov.`);
  }
}

export async function processEmailOutbox(limit = 10) {
  const claimed = await claimOutbox(Math.max(1, Math.min(limit, 50)));
  await Promise.all(claimed.map(deliver));
  return { claimed: claimed.length };
}

export async function retryEmailOutbox(outboxId: string) {
  const now = new Date();
  const claimed = await prisma.emailOutbox.updateMany({
    where: { id: outboxId, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "PROCESSING", attempts: { increment: 1 }, lastAttemptAt: now, leaseUntil: new Date(now.getTime() + 120_000), lastError: null },
  });
  if (claimed.count === 0) return { claimed: 0 };
  const item = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: outboxId } });
  await deliver({ id: item.id, leadId: item.leadId, kind: item.kind, attempts: item.attempts });
  return { claimed: 1 };
}
