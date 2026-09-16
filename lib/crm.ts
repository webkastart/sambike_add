import type { LeadStatus } from "@/generated/prisma/client";

export const leadStatuses = ["NEW", "CONTACTED", "BOOKED", "COMPLETED", "LOST", "SPAM"] as const;
export type LeadStatusValue = (typeof leadStatuses)[number];

export const leadStatusLabels: Record<LeadStatusValue, string> = {
  NEW: "Nový",
  CONTACTED: "Kontaktovaný",
  BOOKED: "Termín dohodnutý",
  COMPLETED: "Dokončený",
  LOST: "Nezrealizovaný",
  SPAM: "Spam",
};

const transitions: Record<LeadStatusValue, LeadStatusValue[]> = {
  NEW: ["CONTACTED", "LOST", "SPAM"],
  CONTACTED: ["BOOKED", "LOST", "SPAM"],
  BOOKED: ["CONTACTED", "COMPLETED", "LOST"],
  COMPLETED: ["BOOKED"],
  LOST: ["CONTACTED", "SPAM"],
  SPAM: ["NEW"],
};

export function isLeadStatus(value: string): value is LeadStatusValue {
  return leadStatuses.includes(value as LeadStatusValue);
}

export function canTransitionLead(from: LeadStatusValue, to: LeadStatusValue) {
  return from === to || transitions[from].includes(to);
}

export function availableLeadStatuses(current: LeadStatusValue) {
  return [current, ...transitions[current]];
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0") && digits.length === 10) return `+421${digits.slice(1)}`;
  if (digits.startsWith("421")) return `+${digits}`;
  return `+${digits}`;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function parseMoneyToCents(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 100_000_000 ? cents : null;
}

export function attributionSource(input: { utmSource?: string | null; referrer?: string | null }) {
  const source = input.utmSource?.trim().toLowerCase() ?? "";
  if (source.includes("instagram") || source === "ig") return "Instagram";
  if (source.includes("facebook") || source === "fb" || source === "meta") return "Meta / Facebook";
  if (source.includes("google")) return "Google";
  if (source) return input.utmSource!;
  if (!input.referrer) return "Direct / neznámy";
  try {
    return `Referral · ${new URL(input.referrer).hostname.replace(/^www\./, "")}`;
  } catch {
    return "Referral";
  }
}

export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function statusTimestampData(status: LeadStatusValue, now = new Date()) {
  if (status === "CONTACTED") return { firstContactedAt: now };
  if (status === "BOOKED") return { bookedAt: now };
  if (status === "COMPLETED") return { completedAt: now, closedAt: now };
  if (status === "LOST" || status === "SPAM") return { closedAt: now };
  return {};
}

export function asLeadStatus(value: LeadStatusValue) {
  return value as LeadStatus;
}
