import "server-only";

import { prisma } from "@/lib/prisma";

const DEFAULT_NOTIFICATION_EMAIL = "sambike.snv@gmail.com";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function getConfiguredNotificationEmails() {
  const configuredEmails = process.env.LEAD_NOTIFICATION_EMAILS
    ?? process.env.LEAD_NOTIFICATION_EMAIL
    ?? DEFAULT_NOTIFICATION_EMAIL;
  const emails = configuredEmails
    .split(/[,;\n]/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const invalidEmails = emails.filter((email) => !isEmail(email));

  if (invalidEmails.length > 0) {
    console.warn(`Neplatné adresy v LEAD_NOTIFICATION_EMAILS sa preskočili: ${invalidEmails.join(", ")}`);
  }

  return [...new Set(emails.filter(isEmail))];
}

export async function getNotificationRecipientSettings() {
  const emails = getConfiguredNotificationEmails();
  const preferences = emails.length > 0
    ? await prisma.leadNotificationRecipient.findMany({ where: { email: { in: emails } } })
    : [];
  const preferenceByEmail = new Map(preferences.map((preference) => [preference.email, preference.enabled]));

  return emails.map((email) => ({
    email,
    enabled: preferenceByEmail.get(email) ?? true,
  }));
}

export async function getActiveNotificationEmails() {
  const recipients = await getNotificationRecipientSettings();
  return recipients.filter((recipient) => recipient.enabled).map((recipient) => recipient.email);
}
