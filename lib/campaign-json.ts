export const campaignJsonStringFields = [
  "name",
  "slug",
  "headline",
  "description",
  "imageUrl",
  "offerImageUrl",
  "priceText",
  "ctaText",
  "offerType",
  "phone",
  "email",
  "openingHours",
  "address",
  "mapUrl",
  "trustText",
  "responseTimeText",
  "finalCtaText",
  "seoTitle",
  "seoDescription",
  "canonicalUrl",
  "ogTitle",
  "ogDescription",
  "ogImageUrl",
  "legalUrl",
] as const;

export const campaignJsonBooleanFields = ["formEnabled", "noIndex"] as const;

export type CampaignJsonStringField = (typeof campaignJsonStringFields)[number];
export type CampaignJsonBooleanField = (typeof campaignJsonBooleanFields)[number];

type ContentItem = { title: string; text: string };
type FaqItem = { question: string; answer: string };
type TestimonialItem = { name: string; text: string };

export type CampaignJsonDocument = Record<CampaignJsonStringField, string> &
  Record<CampaignJsonBooleanField, boolean> & {
    schemaVersion: 1;
    benefits: ContentItem[];
    processSteps: ContentItem[];
    faq: FaqItem[];
    testimonials: TestimonialItem[];
  };

export type CampaignJsonResult =
  | { success: true; data: CampaignJsonDocument }
  | { success: false; error: string };

const structuredFields = {
  benefits: { first: "title", second: "text", maxItems: 8 },
  processSteps: { first: "title", second: "text", maxItems: 8 },
  faq: { first: "question", second: "answer", maxItems: 10 },
  testimonials: { first: "name", second: "text", maxItems: 8 },
} as const;

export const campaignJsonStructuredFields = Object.keys(structuredFields) as Array<keyof typeof structuredFields>;

function jsonPayload(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;

  const firstLineEnd = trimmed.indexOf("\n");
  const lastFence = trimmed.lastIndexOf("```");
  return firstLineEnd >= 0 && lastFence > firstLineEnd
    ? trimmed.slice(firstLineEnd + 1, lastFence).trim()
    : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function slovakFieldList(fields: string[]) {
  return fields.length === 1 ? `pole „${fields[0]}“` : `polia ${fields.map((field) => `„${field}“`).join(", ")}`;
}

export function parseCampaignJson(value: string): CampaignJsonResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPayload(value));
  } catch {
    return { success: false, error: "JSON nie je platný. Skopírujte iba celý JSON objekt z odpovede AI." };
  }

  if (!isRecord(parsed)) {
    return { success: false, error: "JSON musí obsahovať jeden objekt kampane." };
  }

  if (parsed.schemaVersion !== 1) {
    return { success: false, error: "Chýba podporovaná hodnota „schemaVersion“: 1." };
  }

  const missingFields = [
    ...campaignJsonStringFields,
    ...campaignJsonBooleanFields,
    ...campaignJsonStructuredFields,
  ].filter((field) => !(field in parsed));
  if (missingFields.length) {
    return { success: false, error: `AI vynechala ${slovakFieldList(missingFields)}. Požiadajte ju, aby zachovala všetky polia zo šablóny.` };
  }

  const invalidStrings = campaignJsonStringFields.filter((field) => typeof parsed[field] !== "string");
  if (invalidStrings.length) {
    return { success: false, error: `${slovakFieldList(invalidStrings)} musí obsahovať text.` };
  }

  const invalidBooleans = campaignJsonBooleanFields.filter((field) => typeof parsed[field] !== "boolean");
  if (invalidBooleans.length) {
    return { success: false, error: `${slovakFieldList(invalidBooleans)} musí mať hodnotu true alebo false.` };
  }

  for (const field of campaignJsonStructuredFields) {
    const value = parsed[field];
    const config = structuredFields[field];
    if (!Array.isArray(value) || value.length > config.maxItems) {
      return { success: false, error: `Pole „${field}“ musí byť zoznam s najviac ${config.maxItems} položkami.` };
    }
    const invalidItem = value.some((item) => (
      !isRecord(item)
      || typeof item[config.first] !== "string"
      || typeof item[config.second] !== "string"
    ));
    if (invalidItem) {
      return { success: false, error: `Pole „${field}“ obsahuje neplatnú položku. Zachovajte štruktúru zo skopírovanej šablóny.` };
    }
  }

  return { success: true, data: parsed as CampaignJsonDocument };
}

export function campaignJsonItemsFromText(
  value: string,
  field: keyof typeof structuredFields,
): Array<Record<string, string>> {
  const config = structuredFields[field];
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, config.maxItems).flatMap((line) => {
    const separator = line.indexOf("|");
    if (separator < 1) return [];
    const first = line.slice(0, separator).trim();
    const second = line.slice(separator + 1).trim();
    return first && second ? [{ [config.first]: first, [config.second]: second }] : [];
  });
}

export function campaignJsonItemsToText(
  items: CampaignJsonDocument[keyof Pick<CampaignJsonDocument, "benefits" | "processSteps" | "faq" | "testimonials">],
  field: keyof typeof structuredFields,
) {
  const config = structuredFields[field];
  return items.map((item) => {
    const record = item as unknown as Record<string, string>;
    return `${record[config.first]} | ${record[config.second]}`;
  }).join("\n");
}

export function campaignAiPrompt(document: CampaignJsonDocument, instruction = "") {
  const campaignDescription = instruction.trim() || "[Sem napíšte, čo chcete propagovať, pre koho je ponuka, cenu alebo podmienky a ďalšie dôležité fakty.]";
  return `OPIS KAMPANE:\n${campaignDescription}\n\nÚLOHA PRE AI:\nVyplň nižšie uvedený JSON ako kvalitnú slovenskú marketingovú kampaň pre cyklo prevádzku Sambike. Vráť iba jeden platný JSON objekt bez Markdownu a bez vysvetlenia. Zachovaj všetky názvy polí, schemaVersion a dátové typy. Text má byť jasný, prirodzený a presvedčivý. Nevymýšľaj si cenu, referencie, otváracie hodiny, adresu, certifikácie ani sľuby, ktoré nie sú v opise. Ak tieto údaje nedostaneš, nechaj príslušnú nepovinnú hodnotu prázdnu. Pole slug píš malými písmenami bez diakritiky, so slovami oddelenými pomlčkami. imageUrl a offerImageUrl nemeň, ak používateľ nedodá konkrétne URL. SEO title má mať najviac 70 znakov a SEO description najviac 180 znakov.\n\nJSON ŠABLÓNA:\n${JSON.stringify(document, null, 2)}`;
}
