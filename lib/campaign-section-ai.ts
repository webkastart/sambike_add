import {
  defaultSectionContent,
  sanitizeSectionContent,
  type CampaignSectionContent,
  type CampaignSectionTypeValue,
  type EditableCampaignSection,
} from "@/lib/campaign-sections";

export type CampaignSectionAiDocument = {
  schemaVersion: 1;
  sectionType: CampaignSectionTypeValue;
  content: CampaignSectionContent;
};

export type CampaignSectionAiResult =
  | { success: true; data: CampaignSectionContent }
  | { success: false; error: string };

const listConfig: Partial<Record<CampaignSectionTypeValue, { field: "items" | "steps"; keys: readonly [string, string]; maxItems: number }>> = {
  HERO: { field: "steps", keys: ["title", "text"], maxItems: 6 },
  BENEFITS: { field: "items", keys: ["title", "text"], maxItems: 8 },
  FAQ: { field: "items", keys: ["question", "answer"], maxItems: 12 },
  TESTIMONIALS: { field: "items", keys: ["name", "text"], maxItems: 8 },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonPayload(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;

  const firstLineEnd = trimmed.indexOf("\n");
  const lastFence = trimmed.lastIndexOf("```");
  return firstLineEnd >= 0 && lastFence > firstLineEnd
    ? trimmed.slice(firstLineEnd + 1, lastFence).trim()
    : trimmed;
}

function normalizedContent(section: Pick<EditableCampaignSection, "type" | "content">) {
  return {
    ...defaultSectionContent(section.type),
    ...sanitizeSectionContent(section.type, section.content),
  };
}

export function campaignSectionAiDocument(
  section: Pick<EditableCampaignSection, "type" | "content">,
): CampaignSectionAiDocument {
  return {
    schemaVersion: 1,
    sectionType: section.type,
    content: normalizedContent(section),
  };
}

export function campaignSectionAiPrompt(
  section: Pick<EditableCampaignSection, "type" | "content">,
  instruction = "",
) {
  const document = campaignSectionAiDocument(section);
  const requestedChange = instruction.trim() || "[Sem napíšte AI, čo má v tejto sekcii zmeniť.]";
  return `POŽADOVANÁ ÚPRAVA:\n${requestedChange}\n\nÚLOHA PRE AI:\nUprav nižšie uvedený JSON podľa mojej požiadavky. Text píš po slovensky, prirodzene a presvedčivo. Vráť iba jeden platný JSON objekt bez Markdownu a bez vysvetlenia. Zachovaj schemaVersion, sectionType, všetky názvy polí a dátové typy. Polia, ktoré požiadavka nemení, ponechaj bez zmeny. Nevymýšľaj si cenu, referencie, certifikácie ani sľuby, ktoré nie sú v požiadavke alebo v pôvodnom obsahu. URL obrázkov, videí a odkazov nemeň, pokiaľ to výslovne nepožadujem.\n\nAKTUÁLNY JSON SEKCIE:\n${JSON.stringify(document, null, 2)}`;
}

export function parseCampaignSectionAiJson(
  value: string,
  expectedType: CampaignSectionTypeValue,
): CampaignSectionAiResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPayload(value));
  } catch {
    return { success: false, error: "JSON nie je platný. Vložte celý JSON objekt z odpovede AI." };
  }

  if (!isRecord(parsed)) {
    return { success: false, error: "JSON musí obsahovať jeden objekt sekcie." };
  }
  if (parsed.schemaVersion !== 1) {
    return { success: false, error: "Chýba podporovaná hodnota „schemaVersion“: 1." };
  }
  if (parsed.sectionType !== expectedType) {
    return { success: false, error: "AI zmenila typ sekcie. Použite JSON pre túto konkrétnu sekciu." };
  }
  if (!isRecord(parsed.content)) {
    return { success: false, error: "Pole „content“ musí obsahovať objekt s obsahom sekcie." };
  }
  const content = parsed.content;

  const expectedContent = defaultSectionContent(expectedType);
  const expectedFields = Object.keys(expectedContent);
  const missingFields = expectedFields.filter((field) => !(field in content));
  if (missingFields.length) {
    return {
      success: false,
      error: `AI vynechala ${missingFields.length === 1 ? "pole" : "polia"} ${missingFields.map((field) => `„${field}“`).join(", ")}. Požiadajte ju, aby zachovala všetky polia.`,
    };
  }

  const invalidFields = expectedFields.filter((field) => {
    const expected = expectedContent[field];
    const received = content[field];
    return Array.isArray(expected) ? !Array.isArray(received) : typeof received !== typeof expected;
  });
  if (invalidFields.length) {
    return {
      success: false,
      error: `${invalidFields.length === 1 ? "Pole" : "Polia"} ${invalidFields.map((field) => `„${field}“`).join(", ")} ${invalidFields.length === 1 ? "má" : "majú"} nesprávny dátový typ.`,
    };
  }

  const list = listConfig[expectedType];
  if (list) {
    const items = content[list.field] as unknown[];
    const invalidItems = items.length > list.maxItems || items.some((item) => (
      !isRecord(item)
      || list.keys.some((key) => typeof item[key] !== "string" || !item[key].trim())
    ));
    if (invalidItems) {
      return {
        success: false,
        error: `Pole „${list.field}“ musí mať najviac ${list.maxItems} úplných položiek so zachovanou štruktúrou.`,
      };
    }
  }

  return { success: true, data: sanitizeSectionContent(expectedType, content) };
}
