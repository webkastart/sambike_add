import { createHmac, timingSafeEqual } from "node:crypto";

export const campaignStatuses = ["DRAFT", "READY", "PUBLISHED", "PAUSED", "ARCHIVED"] as const;
export type CampaignStatusValue = (typeof campaignStatuses)[number];

const transitions: Record<CampaignStatusValue, CampaignStatusValue[]> = {
  DRAFT: ["READY", "ARCHIVED"],
  READY: ["DRAFT", "PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["PAUSED", "ARCHIVED"],
  PAUSED: ["DRAFT", "READY", "PUBLISHED", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export function canTransitionCampaign(from: CampaignStatusValue, to: CampaignStatusValue) {
  return from === to || transitions[from].includes(to);
}

export type StructuredItem = { title: string; text: string };
export type FaqItem = { question: string; answer: string };
export type TestimonialItem = { name: string; text: string };

function safeLines(value: string, maxItems: number, firstMax: number, secondMax: number) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, maxItems).flatMap((line) => {
    const separator = line.indexOf("|");
    if (separator < 1) return [];
    const first = line.slice(0, separator).trim().slice(0, firstMax);
    const second = line.slice(separator + 1).trim().slice(0, secondMax);
    return first && second ? [{ first, second }] : [];
  });
}

export function parseStructuredItems(value: string): StructuredItem[] {
  return safeLines(value, 8, 80, 240).map(({ first, second }) => ({ title: first, text: second }));
}

export function parseFaq(value: string): FaqItem[] {
  return safeLines(value, 10, 160, 600).map(({ first, second }) => ({ question: first, answer: second }));
}

export function parseTestimonials(value: string): TestimonialItem[] {
  return safeLines(value, 8, 100, 500).map(({ first, second }) => ({ name: first, text: second }));
}

export function structuredItemsText(value: unknown, kind: "items" | "faq" | "testimonials") {
  if (!Array.isArray(value)) return "";
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const first = kind === "faq" ? record.question : kind === "testimonials" ? record.name : record.title;
    const second = kind === "faq" ? record.answer : record.text;
    return typeof first === "string" && typeof second === "string" ? [`${first} | ${second}`] : [];
  }).join("\n");
}

export const campaignTemplates = {
  service: {
    name: "Servis bicyklov",
    headline: "Servis bicyklov s osobným prístupom",
    description: "Napíšte nám, čo váš bicykel potrebuje. Ozveme sa, dohodneme rozsah aj termín a postaráme sa o spoľahlivý výsledok.",
    ctaText: "Objednať servis",
    priceText: "Cena podľa rozsahu servisu",
    offerType: "Servis bicyklov",
    benefits: "Jasný termín | Dostupný termín si spolu potvrdíme.\nOsobný prístup | Najprv si vypočujeme problém a navrhneme postup.\nSpoľahlivý výsledok | Bicykel skontrolujeme s dôrazom na bezpečnosť.",
    processSteps: "Pošlite požiadavku | Stačí meno, telefón a stručná poznámka.\nPotvrdíme rozsah | Zavoláme vám a dohodneme termín.\nPrevezmete bicykel | Vysvetlíme vykonanú prácu a odporúčania.",
    faq: "Ako si objednám servis? | Vyplňte krátky formulár alebo nám zavolajte.\nKedy budem poznať termín? | Po prijatí požiadavky vám termín potvrdíme telefonicky.",
  },
  rental: {
    name: "Požičovňa e-bikov",
    headline: "Objavte okolie na e-biku",
    description: "Vyberte si termín a počet bicyklov. Dostupnosť vám potvrdíme telefonicky.",
    ctaText: "Overiť dostupnosť",
    priceText: "Cena podľa typu bicykla a dĺžky prenájmu",
    offerType: "Požičovňa e-bikov",
    benefits: "Overená dostupnosť | Termín vám potvrdíme pred návštevou.\nNastavenie bicykla | Pomôžeme s veľkosťou a základným nastavením.\nTipy na trasu | Odporučíme trasu podľa vašich skúseností.",
    processSteps: "Vyberte termín | Napíšte dátum a počet osôb.\nPotvrdíme bicykle | Telefonicky overíme veľkosti a dostupnosť.\nVyrazíte na trasu | Pri prevzatí vysvetlíme ovládanie.",
    faq: "Je rezervácia záväzná? | Dostupnosť a podmienky potvrdíme telefonicky.\nČo si mám priniesť? | Konkrétne podmienky vám oznámime pri potvrdení.",
  },
  seasonal: {
    name: "Sezónna ponuka",
    headline: "Pripravte bicykel na sezónu",
    description: "Sezónna ponuka s jasnými podmienkami. Pošlite požiadavku a overíme dostupný termín.",
    ctaText: "Chcem ponuku",
    priceText: "Doplňte cenu a presné podmienky",
    offerType: "Sezónna ponuka",
    benefits: "Jasné podmienky | Pred publikovaním doplňte presný rozsah ponuky.\nJednoduchá rezervácia | Krátky formulár zaberie menej než minútu.\nLokálny servis | Všetko dohodnete priamo so Sambike.",
    processSteps: "Vyberte ponuku | Skontrolujte cenu a podmienky.\nPošlite kontakt | Uveďte telefón a preferovaný termín.\nPotvrdíme objednávku | Ozveme sa s dostupnosťou.",
    faq: "Dokedy ponuka platí? | Doplňte dátum platnosti pred publikovaním.\nJe potrebná rezervácia? | Dostupnosť vždy potvrdíme telefonicky.",
  },
} as const;

export type ReadinessItem = { key: string; label: string; level: "required" | "recommended"; ready: boolean; detail?: string };

type ReadinessCampaign = {
  name: string; slug: string; headline: string; description: string; ctaText: string; priceText: string;
  phone: string; email: string; imageUrl: string; formEnabled: boolean; legalUrl: string;
  seoTitle: string | null; seoDescription: string | null; address: string | null; openingHours: string | null;
  metaAd?: { destinationUrl: string; dailyBudgetCents: number } | null;
  galleryItems?: Array<{ mediaUrl: string }>;
};

function validUrl(value: string, allowRelative = false) {
  if (allowRelative && value.startsWith("/") && !value.startsWith("//")) {
    try { return new URL(value, "https://sambike.invalid").origin === "https://sambike.invalid"; } catch { return false; }
  }
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; }
}

export function campaignReadiness(campaign: ReadinessCampaign, options: { slugUnique?: boolean; appUrl?: string; requireProductionUrl?: boolean } = {}) {
  const appUrl = options.appUrl ?? process.env.APP_URL ?? "";
  let productionUrlReady = false;
  try {
    const url = new URL(appUrl);
    productionUrlReady = url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname);
  } catch { /* invalid */ }
  const items: ReadinessItem[] = [
    { key: "name", label: "Názov kampane", level: "required", ready: campaign.name.trim().length >= 2 },
    { key: "slug", label: "Jedinečná adresa stránky", level: "required", ready: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(campaign.slug) && options.slugUnique !== false },
    { key: "content", label: "Hlavný nadpis a popis", level: "required", ready: campaign.headline.trim().length >= 5 && campaign.description.trim().length >= 20 },
    { key: "cta", label: "CTA a cena/podmienky", level: "required", ready: campaign.ctaText.trim().length >= 2 && campaign.priceText.trim().length >= 2 },
    { key: "contact", label: "Platný telefón a e-mail", level: "required", ready: /[0-9]{7,}/.test(campaign.phone.replace(/\s/g, "")) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campaign.email) },
    { key: "hero", label: "Hero obrázok", level: "required", ready: validUrl(campaign.imageUrl, true) },
    { key: "media", label: "Dostupné URL galérie", level: "required", ready: (campaign.galleryItems ?? []).every((item) => validUrl(item.mediaUrl, true)) },
    { key: "form", label: "Formulár alebo kontaktná alternatíva", level: "required", ready: campaign.formEnabled || Boolean(campaign.email || campaign.phone) },
    { key: "legal", label: "Odkaz na ochranu osobných údajov", level: "required", ready: validUrl(campaign.legalUrl, true) },
    { key: "seo", label: "SEO title a description", level: "required", ready: Boolean(campaign.seoTitle?.trim()) && Boolean(campaign.seoDescription?.trim()) },
    { key: "productionUrl", label: "Verejná HTTPS produkčná URL", level: options.requireProductionUrl === false ? "recommended" : "required", ready: productionUrlReady, detail: appUrl || "APP_URL nie je nastavené" },
    { key: "business", label: "Adresa a otváracie hodiny", level: "recommended", ready: Boolean(campaign.address?.trim()) && Boolean(campaign.openingHours?.trim()) },
    { key: "meta", label: "Meta nastavenia reklamy", level: "recommended", ready: !campaign.metaAd || (validUrl(campaign.metaAd.destinationUrl) && campaign.metaAd.dailyBudgetCents > 0) },
  ];
  return { items, ready: items.every((item) => item.level !== "required" || item.ready) };
}

export const snapshotFields = [
  "name", "slug", "headline", "description", "imageUrl", "offerImageUrl", "priceText", "ctaText", "offerType", "phone", "email", "formEnabled",
  "benefits", "processSteps", "faq", "testimonials", "openingHours", "address", "mapUrl", "trustText", "responseTimeText", "finalCtaText", "sectionOrder",
  "seoTitle", "seoDescription", "canonicalUrl", "ogTitle", "ogDescription", "ogImageUrl", "noIndex", "legalUrl",
] as const;

export function publicationSnapshot(campaign: Record<string, unknown> & { galleryItems?: unknown[]; sections?: unknown[] }) {
  return Object.fromEntries([
    ...snapshotFields.map((field) => [field, campaign[field]]),
    ["galleryItems", (campaign.galleryItems ?? []).map((item) => {
      const value = item as Record<string, unknown>;
      return {
        mediaUrl: value.mediaUrl,
        mediaType: value.mediaType,
        caption: value.caption,
        placement: value.placement,
        sortOrder: value.sortOrder,
      };
    })],
    ["sections", (campaign.sections ?? []).map((section) => {
      const value = section as Record<string, unknown>;
      return { type: value.type, position: value.position, isVisible: value.isVisible, content: value.content };
    })],
  ]);
}

export function changedSnapshotFields(previous: unknown, current: unknown) {
  const before = previous && typeof previous === "object" ? previous as Record<string, unknown> : {};
  const after = current && typeof current === "object" ? current as Record<string, unknown> : {};
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

const previewLifetimeMs = 15 * 60 * 1000;
function previewSecret() { return process.env.CAMPAIGN_PREVIEW_SECRET?.trim() || process.env.ADMIN_SESSION_SECRET?.trim() || ""; }

export function createCampaignPreviewToken(campaignId: string, now = Date.now()) {
  const secret = previewSecret();
  if (!secret) throw new Error("Chýba CAMPAIGN_PREVIEW_SECRET alebo ADMIN_SESSION_SECRET.");
  const payload = `${campaignId}.${now + previewLifetimeMs}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyCampaignPreviewToken(token: string | undefined, campaignId: string, now = Date.now()) {
  if (!token) return false;
  const [tokenCampaignId, expiresRaw, signature] = token.split(".");
  const expires = Number(expiresRaw);
  const secret = previewSecret();
  if (!secret || tokenCampaignId !== campaignId || !Number.isFinite(expires) || expires < now || expires > now + previewLifetimeMs + 5_000 || !signature) return false;
  const expected = createHmac("sha256", secret).update(`${tokenCampaignId}.${expiresRaw}`).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return false; }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function assignVariant(seed: string) {
  const digest = createHmac("sha256", "sambike-campaign-variant-v1").update(seed).digest();
  return digest[0] % 2 === 0 ? "A" : "B";
}

export function variantConversion(views: number, leads: number) {
  return { views, leads, conversion: views > 0 ? leads / views : null, indicative: views < 100 || leads < 10 };
}

export function parseBratislavaDateTime(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  const wallClockUtc = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]);
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const shown = Object.fromEntries(formatter.formatToParts(new Date(wallClockUtc)).map((part) => [part.type, part.value]));
  const offset = Date.UTC(Number(shown.year), Number(shown.month) - 1, Number(shown.day), Number(shown.hour), Number(shown.minute)) - wallClockUtc;
  const result = new Date(wallClockUtc - offset);
  return Number.isNaN(result.getTime()) ? null : result;
}
