export const campaignSectionTypes = [
  "HERO",
  "TEXT_IMAGE",
  "BENEFITS",
  "OFFER",
  "GALLERY",
  "VIDEO",
  "FAQ",
  "TESTIMONIALS",
  "CTA",
  "FORM",
] as const;

export type CampaignSectionTypeValue = (typeof campaignSectionTypes)[number];
export type CampaignSectionContent = Record<string, unknown>;
export type EditableCampaignSection = {
  id: string;
  type: CampaignSectionTypeValue;
  position: number;
  isVisible: boolean;
  content: CampaignSectionContent;
};

type LegacyCampaign = {
  id: string;
  name: string;
  headline: string;
  description: string;
  imageUrl: string;
  offerImageUrl?: string | null;
  priceText: string;
  ctaText: string;
  offerType: string;
  email: string;
  formEnabled: boolean;
  benefits?: unknown;
  processSteps?: unknown;
  faq?: unknown;
  testimonials?: unknown;
  responseTimeText?: string | null;
  finalCtaText?: string | null;
  sections?: Array<{
    id: string;
    type: string;
    position: number;
    isVisible: boolean;
    content: unknown;
  }>;
  galleryItems?: Array<{ mediaType?: string; mediaUrl?: string; placement?: string }>;
};

const typeSet = new Set<string>(campaignSectionTypes);
const fallbackBenefits = [
  { title: "Jasný termín", text: "Dostupný termín si spolu potvrdíme telefonicky." },
  { title: "Osobný prístup", text: "Najprv si vypočujeme problém a navrhneme ďalší postup." },
  { title: "Spoľahlivý výsledok", text: "Bicykel skontrolujeme s dôrazom na bezpečnosť a detail." },
];
const fallbackFaq = [
  { question: "Ako si objednám servis?", answer: "Vyplňte krátky formulár alebo nám zavolajte. Následne spolu potvrdíme termín a ďalší postup." },
  { question: "Kedy budem poznať termín?", answer: "Po prijatí požiadavky sa vám ozveme a overíme dostupný termín." },
  { question: "Čo mám uviesť do poznámky?", answer: "Napíšte typ bicykla, stručný opis problému a želaný termín." },
];

function objectContent(value: unknown): CampaignSectionContent {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as CampaignSectionContent
    : {};
}

function legacyId(campaignId: string, suffix: string) {
  return `${campaignId}-${suffix}`;
}

export function legacyCampaignSections(campaign: LegacyCampaign): EditableCampaignSection[] {
  const galleryVisible = (campaign.galleryItems ?? []).some((item) => item.placement === "GALLERY" || !item.placement);
  const heroImage = (campaign.galleryItems ?? []).find((item) => item.placement === "HERO" && item.mediaType !== "VIDEO")?.mediaUrl || campaign.imageUrl;
  const offerImage = (campaign.galleryItems ?? []).find((item) => item.placement === "OFFER" && item.mediaType !== "VIDEO")?.mediaUrl || campaign.offerImageUrl || campaign.imageUrl;
  const testimonials = Array.isArray(campaign.testimonials) ? campaign.testimonials : [];
  return [
    {
      id: legacyId(campaign.id, "hero"), type: "HERO", position: 0, isVisible: true,
      content: { eyebrow: campaign.offerType, heading: campaign.headline, description: campaign.description, ctaLabel: campaign.ctaText, imageUrl: heroImage, steps: Array.isArray(campaign.processSteps) ? campaign.processSteps : [] },
    },
    {
      id: legacyId(campaign.id, "benefits"), type: "BENEFITS", position: 1, isVisible: true,
      content: { eyebrow: "Prečo Sambike", heading: "Jemný prístup. Poctivý servis.", items: Array.isArray(campaign.benefits) && campaign.benefits.length ? campaign.benefits : fallbackBenefits },
    },
    {
      id: legacyId(campaign.id, "offer"), type: "OFFER", position: 2, isVisible: true,
      content: { eyebrow: "Aktuálna ponuka", heading: campaign.name, description: campaign.description, priceText: campaign.priceText, ctaLabel: campaign.ctaText, imageUrl: offerImage },
    },
    {
      id: legacyId(campaign.id, "form"), type: "FORM", position: 3, isVisible: campaign.formEnabled,
      content: { eyebrow: "Nezáväzná požiadavka", heading: "Dohodnime si podrobnosti.", description: campaign.responseTimeText || "Stačí meno a telefón. Ozveme sa a spolu dohodneme termín aj rozsah." },
    },
    {
      id: legacyId(campaign.id, "gallery"), type: "GALLERY", position: 4, isVisible: galleryVisible,
      content: { eyebrow: "Práca zo servisu", heading: "Detail, ktorý je vidieť.", description: "Skutočné fotografie a videá zo servisu Sambike." },
    },
    {
      id: legacyId(campaign.id, "faq"), type: "FAQ", position: 5, isVisible: true,
      content: { eyebrow: "Praktické informácie", heading: "Časté otázky.", items: Array.isArray(campaign.faq) && campaign.faq.length ? campaign.faq : fallbackFaq },
    },
    {
      id: legacyId(campaign.id, "testimonials"), type: "TESTIMONIALS", position: 6, isVisible: testimonials.length > 0,
      content: { eyebrow: "Referencie zákazníkov", heading: "Skúsenosti zákazníkov.", items: testimonials },
    },
    {
      id: legacyId(campaign.id, "cta"), type: "CTA", position: 7, isVisible: true,
      content: { eyebrow: "Dohodnite si termín", heading: campaign.finalCtaText || "Pošlite nám nezáväznú požiadavku.", ctaLabel: campaign.ctaText, href: campaign.formEnabled ? "#mam-zaujem" : `mailto:${campaign.email}` },
    },
  ];
}

export function resolveCampaignSections(campaign: LegacyCampaign): EditableCampaignSection[] {
  if (!campaign.sections?.length) return legacyCampaignSections(campaign);
  return campaign.sections
    .filter((section) => typeSet.has(section.type))
    .map((section) => ({
      id: section.id,
      type: section.type as CampaignSectionTypeValue,
      position: section.position,
      isVisible: section.isVisible,
      content: objectContent(section.content),
    }))
    .sort((a, b) => a.position - b.position);
}

function clippedString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeHref(value: unknown) {
  const href = clippedString(value, 1000);
  if (/^(https?:\/\/|mailto:|tel:|#|\/)/.test(href) && !href.startsWith("//")) return href;
  return "";
}

function safeMediaUrl(value: unknown) {
  const url = clippedString(value, 1000);
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : "";
  } catch { return ""; }
}

function itemList(value: unknown, first: string, second: string, maxItems: number) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const firstValue = clippedString(record[first], first === "question" ? 160 : 100);
    const secondValue = clippedString(record[second], second === "answer" ? 600 : 500);
    return firstValue && secondValue ? [{ [first]: firstValue, [second]: secondValue }] : [];
  });
}

export function sanitizeSectionContent(type: CampaignSectionTypeValue, value: unknown): CampaignSectionContent {
  const input = objectContent(value);
  const common = {
    eyebrow: clippedString(input.eyebrow, 100),
    heading: clippedString(input.heading, 180),
    description: clippedString(input.description, 1200),
  };
  switch (type) {
    case "HERO":
      return { ...common, ctaLabel: clippedString(input.ctaLabel, 80), imageUrl: safeMediaUrl(input.imageUrl), steps: itemList(input.steps, "title", "text", 6) };
    case "TEXT_IMAGE":
      return { ...common, imageUrl: safeMediaUrl(input.imageUrl), imageAlt: clippedString(input.imageAlt, 240) };
    case "BENEFITS":
      return { ...common, items: itemList(input.items, "title", "text", 8) };
    case "OFFER":
      return { ...common, priceText: clippedString(input.priceText, 180), ctaLabel: clippedString(input.ctaLabel, 80), imageUrl: safeMediaUrl(input.imageUrl) };
    case "GALLERY":
      return common;
    case "VIDEO":
      return { ...common, videoUrl: safeMediaUrl(input.videoUrl), caption: clippedString(input.caption, 240) };
    case "FAQ":
      return { ...common, items: itemList(input.items, "question", "answer", 12) };
    case "TESTIMONIALS":
      return { ...common, items: itemList(input.items, "name", "text", 8) };
    case "CTA":
      return { ...common, ctaLabel: clippedString(input.ctaLabel, 80), href: safeHref(input.href) };
    case "FORM":
      return common;
  }
}

export function parseCampaignSections(value: FormDataEntryValue | null): EditableCampaignSection[] | null {
  if (typeof value !== "string") return null;
  let input: unknown;
  try { input = JSON.parse(value); } catch { return null; }
  if (!Array.isArray(input) || input.length === 0 || input.length > 30) return null;
  const ids = new Set<string>();
  const sections: EditableCampaignSection[] = [];
  for (const [position, item] of input.entries()) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(record.id) || ids.has(record.id)) return null;
    if (typeof record.type !== "string" || !typeSet.has(record.type)) return null;
    ids.add(record.id);
    const type = record.type as CampaignSectionTypeValue;
    sections.push({ id: record.id, type, position, isVisible: record.isVisible !== false, content: sanitizeSectionContent(type, record.content) });
  }
  return sections;
}

export function defaultSectionContent(type: CampaignSectionTypeValue): CampaignSectionContent {
  switch (type) {
    case "HERO": return { eyebrow: "Nová ponuka", heading: "Hlavný nadpis kampane", description: "Stručne vysvetlite, čo zákazník získa.", ctaLabel: "Mám záujem", imageUrl: "", steps: [] };
    case "TEXT_IMAGE": return { eyebrow: "O nás", heading: "Dôležitá informácia", description: "Doplňte text tejto sekcie.", imageUrl: "", imageAlt: "" };
    case "BENEFITS": return { eyebrow: "Výhody", heading: "Prečo si vybrať túto ponuku", description: "", items: [{ title: "Prvá výhoda", text: "Krátke vysvetlenie výhody." }, { title: "Druhá výhoda", text: "Krátke vysvetlenie výhody." }] };
    case "OFFER": return { eyebrow: "Ponuka", heading: "Názov ponuky", description: "Doplňte stručný popis.", priceText: "Doplňte cenu a podmienky", ctaLabel: "Mám záujem", imageUrl: "" };
    case "GALLERY": return { eyebrow: "Galéria", heading: "Ukážky našej práce", description: "" };
    case "VIDEO": return { eyebrow: "Video", heading: "Pozrite si video", description: "", videoUrl: "", caption: "" };
    case "FAQ": return { eyebrow: "Praktické informácie", heading: "Časté otázky", description: "", items: [{ question: "Prvá otázka", answer: "Doplňte odpoveď." }] };
    case "TESTIMONIALS": return { eyebrow: "Referencie", heading: "Skúsenosti zákazníkov", description: "", items: [] };
    case "CTA": return { eyebrow: "Máte záujem?", heading: "Pošlite nám nezáväznú požiadavku.", description: "", ctaLabel: "Mám záujem", href: "#mam-zaujem" };
    case "FORM": return { eyebrow: "Nezáväzná požiadavka", heading: "Dohodnime si podrobnosti.", description: "Stačí meno a telefón. Ozveme sa vám." };
  }
}

export function sectionContentString(content: CampaignSectionContent, key: string, fallback = "") {
  const value = content[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}
