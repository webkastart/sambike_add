"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { canTransitionLead, isLeadStatus, leadStatusLabels, parseMoneyToCents } from "@/lib/crm";
import { formatBratislavaDateTime, fromBratislavaLocal } from "@/lib/date-range";
import { retryEmailOutbox } from "@/lib/email-outbox";
import { prisma } from "@/lib/prisma";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function detailPath(id: string, key: string, message = "1") {
  return `/admin/leady/${id}?${key}=${encodeURIComponent(message)}`;
}

export async function updateLeadStatus(id: string, formData: FormData) {
  const { actor } = await requireAdmin();
  const requested = value(formData, "status");
  if (!isLeadStatus(requested)) redirect(detailPath(id, "error", "Neplatný stav leadu."));
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) redirect("/admin/leady");
  if (!canTransitionLead(lead.status, requested)) {
    redirect(detailPath(id, "error", `Zmena zo stavu ${leadStatusLabels[lead.status]} na ${leadStatusLabels[requested]} nie je povolená.`));
  }

  const lostReason = value(formData, "lostReason").slice(0, 500);
  const rawAmount = value(formData, "completedValue");
  const completedValueCents = rawAmount ? parseMoneyToCents(rawAmount) : null;
  if (requested === "COMPLETED" && rawAmount && completedValueCents === null) {
    redirect(detailPath(id, "error", "Hodnota zákazky musí byť nezáporná suma s najviac dvoma desatinnými miestami."));
  }

  const now = new Date();
  const data = {
    status: requested,
    lostReason: requested === "LOST" ? lostReason || null : null,
    completedValueCents: requested === "COMPLETED" ? completedValueCents : null,
    completedValueCurrency: requested === "COMPLETED" && completedValueCents !== null ? "EUR" : null,
    firstContactedAt: requested === "CONTACTED" && !lead.firstContactedAt ? now : lead.firstContactedAt,
    bookedAt: requested === "BOOKED" ? now : lead.bookedAt,
    completedAt: requested === "COMPLETED" ? now : lead.completedAt,
    closedAt: ["COMPLETED", "LOST", "SPAM"].includes(requested) ? now : null,
  };
  await prisma.$transaction([
    prisma.lead.update({ where: { id }, data }),
    prisma.leadActivity.create({
      data: {
        leadId: id,
        type: lead.status === requested && lead.completedValueCents !== completedValueCents ? "VALUE_CHANGED" : "STATUS_CHANGED",
        actor,
        fromStatus: lead.status,
        toStatus: requested,
        message: requested === "LOST" && lostReason ? `Dôvod straty: ${lostReason}` : requested === "COMPLETED" && completedValueCents !== null ? `Hodnota zákazky: ${(completedValueCents / 100).toFixed(2)} EUR` : null,
      },
    }),
  ]);
  revalidatePath("/admin");
  revalidatePath("/admin/leady");
  revalidatePath(`/admin/leady/${id}`);
  redirect(detailPath(id, "saved"));
}

export async function addLeadNote(id: string, formData: FormData) {
  const { actor } = await requireAdmin();
  const note = value(formData, "note");
  if (!note || note.length > 2000) redirect(detailPath(id, "error", "Poznámka musí mať 1 až 2 000 znakov."));
  await prisma.leadActivity.create({ data: { leadId: id, type: "NOTE_ADDED", actor, message: note } });
  revalidatePath(`/admin/leady/${id}`);
  redirect(detailPath(id, "saved"));
}

export async function updateLeadFollowUp(id: string, formData: FormData) {
  const { actor } = await requireAdmin();
  const raw = value(formData, "nextFollowUpAt");
  const date = raw ? fromBratislavaLocal(raw) : null;
  if (raw && !date) redirect(detailPath(id, "error", "Termín ďalšieho kontaktu nie je platný."));
  await prisma.$transaction([
    prisma.lead.update({ where: { id }, data: { nextFollowUpAt: date } }),
    prisma.leadActivity.create({ data: { leadId: id, type: "FOLLOW_UP_CHANGED", actor, message: date ? `Ďalší kontakt: ${formatBratislavaDateTime(date)}` : "Follow-up bol označený ako vybavený." } }),
  ]);
  revalidatePath("/admin/leady");
  revalidatePath(`/admin/leady/${id}`);
  redirect(detailPath(id, "saved"));
}

export async function updateLeadAssignee(id: string, formData: FormData) {
  const { actor } = await requireAdmin();
  const assignedTo = value(formData, "assignedTo").slice(0, 100);
  await prisma.$transaction([
    prisma.lead.update({ where: { id }, data: { assignedTo: assignedTo || null } }),
    prisma.leadActivity.create({ data: { leadId: id, type: "ASSIGNEE_CHANGED", actor, message: assignedTo ? `Zodpovedná osoba: ${assignedTo}` : "Zodpovedná osoba bola odstránená." } }),
  ]);
  revalidatePath(`/admin/leady/${id}`);
  redirect(detailPath(id, "saved"));
}

export async function anonymizeLead(id: string) {
  const { actor } = await requireAdmin();
  await prisma.$transaction([
    prisma.lead.update({ where: { id }, data: {
      name: "Anonymizovaný kontakt",
      phone: "",
      email: null,
      normalizedPhone: null,
      normalizedEmail: null,
      note: null,
      assignedTo: null,
      lostReason: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      landingPage: null,
      referrer: null,
      firstUtmSource: null,
      firstUtmMedium: null,
      firstUtmCampaign: null,
      firstUtmContent: null,
      firstUtmTerm: null,
      firstLandingPage: null,
      firstReferrer: null,
      dedupeKey: `anonymized-${id}`,
      anonymizedAt: new Date(),
    } }),
    prisma.leadActivity.create({ data: { leadId: id, type: "ANONYMIZED", actor, message: "Osobné údaje leadu boli anonymizované." } }),
  ]);
  revalidatePath("/admin/leady");
  revalidatePath(`/admin/leady/${id}`);
  redirect(detailPath(id, "saved"));
}

export async function retryLeadNotification(id: string, outboxId: string) {
  const { actor } = await requireAdmin();
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { emailOutbox: { where: { id: outboxId }, take: 1 } },
  });
  if (!lead || lead.anonymizedAt) redirect(detailPath(id, "error", "Notifikáciu anonymizovaného leadu nemožno odoslať."));
  const delivery = lead.emailOutbox[0];
  if (!delivery) redirect(detailPath(id, "error", "Outbox záznam neexistuje alebo nepatrí tomuto leadu."));
  if (delivery.status === "SENT") redirect(detailPath(id, "saved"));
  await retryEmailOutbox(delivery.id);
  const result = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: delivery.id } });
  await prisma.leadActivity.create({ data: { leadId: id, type: result.status === "SENT" ? "NOTIFICATION_SENT" : "NOTIFICATION_RETRIED", actor, message: result.status === "SENT" ? "Admin notifikácia bola opakovane odoslaná." : "Opakované odoslanie admin notifikácie zlyhalo." } });
  revalidatePath(`/admin/leady/${id}`);
  redirect(detailPath(id, result.status === "SENT" ? "saved" : "error", result.status === "SENT" ? "1" : "Notifikáciu sa nepodarilo odoslať."));
}
