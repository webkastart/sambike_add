import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const phonePattern = /^\+?[0-9][0-9 ()/.-]{5,23}$/;

export const leadSubmissionSchema = z.object({
  campaignId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(25).regex(phonePattern),
  email: z.string().trim().max(254).transform((value) => value.toLowerCase()).pipe(z.union([z.literal(""), z.email()])),
  note: optionalText(2000),
  consent: z.literal("on"),
  formToken: z.string().min(20).max(1000),
  turnstileToken: z.string().max(2048),
  website: z.string().max(200),
  utmSource: optionalText(255),
  utmMedium: optionalText(255),
  utmCampaign: optionalText(255),
  utmContent: optionalText(255),
  utmTerm: optionalText(255),
  landingPage: optionalText(2000),
  referrer: optionalText(2000),
  variant: z.union([z.literal("A"), z.literal("B"), z.literal("")]).transform((value) => value || null),
});

export type ValidLeadSubmission = z.infer<typeof leadSubmissionSchema>;

export function normalizePhone(value: string) {
  const compact = value.replace(/[\s()/.-]/g, "");
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (/^09\d{8}$/.test(compact)) return `+421${compact.slice(1)}`;
  if (/^421\d+$/.test(compact)) return `+${compact}`;
  return compact;
}

export function parseLeadSubmission(formData: FormData) {
  const field = (name: string) => String(formData.get(name) ?? "");
  return leadSubmissionSchema.safeParse({
    campaignId: field("campaignId"),
    name: field("name"),
    phone: field("phone"),
    email: field("email"),
    note: field("note"),
    consent: field("consent"),
    formToken: field("formToken"),
    turnstileToken: field("cf-turnstile-response"),
    website: field("website"),
    utmSource: field("utmSource"),
    utmMedium: field("utmMedium"),
    utmCampaign: field("utmCampaign"),
    utmContent: field("utmContent"),
    utmTerm: field("utmTerm"),
    landingPage: field("landingPage"),
    referrer: field("referrer"),
    variant: field("variant"),
  });
}
