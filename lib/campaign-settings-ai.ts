export type CampaignSettingsAiSection = "CAMPAIGN_DETAILS" | "SEO_SHARING";

type FieldDefinition = {
  name: string;
  type: "string" | "boolean";
  maxLength?: number;
};

export const campaignSettingsAiDefinitions = {
  CAMPAIGN_DETAILS: {
    label: "Kampaň a kontakt",
    fields: [
      { name: "name", type: "string", maxLength: 120 },
      { name: "slug", type: "string", maxLength: 120 },
      { name: "phone", type: "string", maxLength: 30 },
      { name: "email", type: "string", maxLength: 254 },
      { name: "responseTimeText", type: "string", maxLength: 200 },
      { name: "trustText", type: "string", maxLength: 500 },
      { name: "openingHours", type: "string", maxLength: 300 },
      { name: "address", type: "string", maxLength: 300 },
      { name: "mapUrl", type: "string", maxLength: 1000 },
    ] satisfies readonly FieldDefinition[],
  },
  SEO_SHARING: {
    label: "SEO a zdieľanie",
    fields: [
      { name: "seoTitle", type: "string", maxLength: 70 },
      { name: "canonicalUrl", type: "string", maxLength: 1000 },
      { name: "seoDescription", type: "string", maxLength: 180 },
      { name: "ogTitle", type: "string", maxLength: 100 },
      { name: "ogImageUrl", type: "string", maxLength: 1000 },
      { name: "ogDescription", type: "string", maxLength: 300 },
      { name: "legalUrl", type: "string", maxLength: 1000 },
      { name: "noIndex", type: "boolean" },
    ] satisfies readonly FieldDefinition[],
  },
} as const;

export type CampaignSettingsAiDocument = {
  schemaVersion: 1;
  sectionType: CampaignSettingsAiSection;
  fields: Record<string, string | boolean>;
};

export type CampaignSettingsAiResult =
  | { success: true; data: Record<string, string | boolean> }
  | { success: false; error: string };

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

export function campaignSettingsAiDocument(
  sectionType: CampaignSettingsAiSection,
  values: Record<string, unknown>,
): CampaignSettingsAiDocument {
  const definition = campaignSettingsAiDefinitions[sectionType];
  return {
    schemaVersion: 1,
    sectionType,
    fields: Object.fromEntries(definition.fields.map((field) => {
      const value = values[field.name];
      return [
        field.name,
        field.type === "boolean" ? value === true : typeof value === "string" ? value : "",
      ];
    })) as Record<string, string | boolean>,
  };
}

export function campaignSettingsAiPrompt(
  sectionType: CampaignSettingsAiSection,
  instruction: string,
  values: Record<string, unknown>,
) {
  const definition = campaignSettingsAiDefinitions[sectionType];
  const requestedChange = instruction.trim() || "[Sem napíšte AI, čo má v tejto časti zmeniť.]";
  const document = campaignSettingsAiDocument(sectionType, values);
  return `POŽADOVANÁ ÚPRAVA:\n${requestedChange}\n\nÚLOHA PRE AI:\nUprav nižšie uvedený JSON časti „${definition.label}“ podľa mojej požiadavky. Text píš po slovensky, prirodzene a vecne. Vráť iba jeden platný JSON objekt bez Markdownu a bez vysvetlenia. Zachovaj schemaVersion, sectionType, všetky názvy polí a dátové typy. Polia, ktoré požiadavka nemení, ponechaj bez zmeny. Nevymýšľaj si kontaktné údaje, adresu, otváracie hodiny ani iné fakty. URL nemeň, pokiaľ to výslovne nepožadujem. SEO title musí mať najviac 70 znakov a SEO description najviac 180 znakov.\n\nAKTUÁLNY JSON ČASTI:\n${JSON.stringify(document, null, 2)}`;
}

export function parseCampaignSettingsAiJson(
  value: string,
  expectedSection: CampaignSettingsAiSection,
): CampaignSettingsAiResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPayload(value));
  } catch {
    return { success: false, error: "JSON nie je platný. Vložte celý JSON objekt z odpovede AI." };
  }

  if (!isRecord(parsed)) return { success: false, error: "JSON musí obsahovať jeden objekt časti." };
  if (parsed.schemaVersion !== 1) return { success: false, error: "Chýba podporovaná hodnota „schemaVersion“: 1." };
  if (parsed.sectionType !== expectedSection) return { success: false, error: "AI zmenila typ časti. Použite JSON pre túto konkrétnu časť." };
  if (!isRecord(parsed.fields)) return { success: false, error: "Pole „fields“ musí obsahovať objekt s hodnotami formulára." };
  const fields = parsed.fields;

  const definition = campaignSettingsAiDefinitions[expectedSection];
  const missingFields = definition.fields.filter((field) => !(field.name in fields));
  if (missingFields.length) {
    return {
      success: false,
      error: `AI vynechala ${missingFields.length === 1 ? "pole" : "polia"} ${missingFields.map((field) => `„${field.name}“`).join(", ")}. Požiadajte ju, aby zachovala všetky polia.`,
    };
  }

  const invalidFields = definition.fields.filter((field) => typeof fields[field.name] !== field.type);
  if (invalidFields.length) {
    return {
      success: false,
      error: `${invalidFields.length === 1 ? "Pole" : "Polia"} ${invalidFields.map((field) => `„${field.name}“`).join(", ")} ${invalidFields.length === 1 ? "má" : "majú"} nesprávny dátový typ.`,
    };
  }

  const tooLongFields = definition.fields.filter((field) => (
    field.type === "string"
    && "maxLength" in field
    && field.maxLength
    && (fields[field.name] as string).length > field.maxLength
  ));
  if (tooLongFields.length) {
    return {
      success: false,
      error: `${tooLongFields.length === 1 ? "Pole" : "Polia"} ${tooLongFields.map((field) => `„${field.name}“`).join(", ")} prekračuje povolenú dĺžku.`,
    };
  }

  return {
    success: true,
    data: Object.fromEntries(definition.fields.map((field) => [field.name, fields[field.name] as string | boolean])),
  };
}
