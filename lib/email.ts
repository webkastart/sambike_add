import "server-only";

import { Resend } from "resend";
import { getActiveNotificationEmails } from "@/lib/notification-recipients";

type LeadNotification = {
  leadId: string;
  name: string;
  phone: string;
  email: string | null;
  interestType: string;
  note: string | null;
  campaignName: string;
  campaignSlug: string;
  createdAt: Date;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

function cleanSubject(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 120);
}

function isEmail(value: string | null): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function getAdminLeadUrl(leadId: string) {
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) return null;

  try {
    return new URL(`/admin/leady/${leadId}`, appUrl).toString();
  } catch {
    console.error("APP_URL nie je platná URL. Odkaz na detail leadu sa do e-mailu nepridal.");
    return null;
  }
}

export async function sendLeadNotification(lead: LeadNotification) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const to = await getActiveNotificationEmails();

  if (!apiKey || !from || to.length === 0) {
    console.warn(
      `E-mail pre lead ${lead.leadId} sa neodoslal: chýba konfigurácia Resend alebo platný príjemca.`,
    );
    return { sent: false as const, reason: "not_configured" as const };
  }

  const resend = new Resend(apiKey);
  const adminUrl = getAdminLeadUrl(lead.leadId);
  const receivedAt = new Intl.DateTimeFormat("sk-SK", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Bratislava",
  }).format(lead.createdAt);
  const safe = {
    name: escapeHtml(lead.name),
    phone: escapeHtml(lead.phone),
    email: lead.email ? escapeHtml(lead.email) : null,
    interestType: escapeHtml(lead.interestType),
    note: lead.note ? escapeHtml(lead.note).replace(/\n/g, "<br>") : null,
    campaignName: escapeHtml(lead.campaignName),
    campaignSlug: escapeHtml(lead.campaignSlug),
    receivedAt: escapeHtml(receivedAt),
    adminUrl: adminUrl ? escapeHtml(adminUrl) : null,
  };

  const contactEmailRow = safe.email
    ? `<tr><td style="padding:7px 0;color:#6b746d;font-size:14px;width:130px">E-mail</td><td style="padding:7px 0;font-size:15px"><a href="mailto:${safe.email}" style="color:#26372a">${safe.email}</a></td></tr>`
    : "";
  const noteSection = safe.note
    ? `<div style="margin-top:28px"><p style="margin:0 0 8px;color:#6b746d;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.08em">Poznámka záujemcu</p><p style="margin:0;color:#273029;font-size:15px;line-height:1.65">${safe.note}</p></div>`
    : "";
  const adminButton = safe.adminUrl
    ? `<a href="${safe.adminUrl}" style="display:inline-block;margin-top:30px;padding:12px 18px;background:#26372a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:7px">Otvoriť detail záujemcu</a>`
    : "";

  const html = `<!doctype html>
<html lang="sk">
  <body style="margin:0;background:#f4f6f3;font-family:Arial,sans-serif;color:#1f2821">
    <div style="padding:32px 16px">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;padding:36px">
        <p style="margin:0;color:#6f7b71;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">SAMBIKE · nový záujemca</p>
        <h1 style="margin:12px 0 8px;font-size:28px;line-height:1.2">${safe.name}</h1>
        <p style="margin:0;color:#657067;font-size:15px">${safe.interestType} · ${safe.campaignName}</p>

        <table role="presentation" style="width:100%;margin-top:28px;border-collapse:collapse;border-top:1px solid #e3e7e2;border-bottom:1px solid #e3e7e2">
          <tr><td style="padding:16px 0 7px;color:#6b746d;font-size:14px;width:130px">Telefón</td><td style="padding:16px 0 7px;font-size:15px"><a href="tel:${safe.phone}" style="color:#26372a;font-weight:600">${safe.phone}</a></td></tr>
          ${contactEmailRow}
          <tr><td style="padding:7px 0;color:#6b746d;font-size:14px">Kampaň</td><td style="padding:7px 0;font-size:15px">${safe.campaignName} <span style="color:#89918b">/${safe.campaignSlug}</span></td></tr>
          <tr><td style="padding:7px 0 16px;color:#6b746d;font-size:14px">Prijaté</td><td style="padding:7px 0 16px;font-size:15px">${safe.receivedAt}</td></tr>
        </table>

        ${noteSection}
        ${adminButton}
        <p style="margin:30px 0 0;color:#929a94;font-size:12px;line-height:1.5">Táto správa bola automaticky odoslaná po vyplnení formulára na stránke SAMBIKE.</p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    "SAMBIKE – nový záujemca",
    "",
    `Meno: ${lead.name}`,
    `Telefón: ${lead.phone}`,
    lead.email ? `E-mail: ${lead.email}` : null,
    `Ponuka: ${lead.interestType}`,
    `Kampaň: ${lead.campaignName} /${lead.campaignSlug}`,
    `Prijaté: ${receivedAt}`,
    lead.note ? `\nPoznámka:\n${lead.note}` : null,
    adminUrl ? `\nDetail záujemcu: ${adminUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { data, error } = await resend.emails.send(
    {
      from,
      to,
      replyTo: isEmail(lead.email) ? lead.email : undefined,
      subject: cleanSubject(`Nový záujemca: ${lead.interestType} – ${lead.name}`),
      html,
      text,
      tags: [{ name: "category", value: "new_lead" }],
    },
    { idempotencyKey: `lead-${lead.leadId}` },
  );

  if (error) {
    console.error(`Resend neodoslal e-mail pre lead ${lead.leadId}:`, error);
    return { sent: false as const, reason: "provider_error" as const };
  }

  return { sent: true as const, emailId: data.id };
}
