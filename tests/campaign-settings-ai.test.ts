import { describe, expect, it } from "vitest";
import {
  campaignSettingsAiPrompt,
  parseCampaignSettingsAiJson,
} from "@/lib/campaign-settings-ai";

describe("AI úprava nastavení kampane", () => {
  it("vloží univerzálny opis pred aktuálny JSON časti", () => {
    const prompt = campaignSettingsAiPrompt("SEO_SHARING", "Zlepši popis pre lokálne vyhľadávanie.", {
      seoTitle: "Servis bicyklov",
      canonicalUrl: "",
      seoDescription: "Servis bicyklov v Spišskej Novej Vsi.",
      ogTitle: "",
      ogImageUrl: "/servis.jpg",
      ogDescription: "",
      legalUrl: "/ochrana-osobnych-udajov",
      noIndex: false,
    });

    expect(prompt).toContain("POŽADOVANÁ ÚPRAVA:\nZlepši popis pre lokálne vyhľadávanie.");
    expect(prompt).toContain('"sectionType": "SEO_SHARING"');
    expect(prompt).toContain('"seoTitle": "Servis bicyklov"');
  });

  it("prijme úplný JSON a odmietne chýbajúce alebo príliš dlhé polia", () => {
    const valid = JSON.stringify({
      schemaVersion: 1,
      sectionType: "SEO_SHARING",
      fields: {
        seoTitle: "Servis bicyklov v Spišskej Novej Vsi",
        canonicalUrl: "",
        seoDescription: "Objednajte si odborný servis bicykla.",
        ogTitle: "Servis bicyklov",
        ogImageUrl: "/servis.jpg",
        ogDescription: "Spoľahlivý lokálny servis.",
        legalUrl: "/ochrana-osobnych-udajov",
        noIndex: false,
      },
    });
    expect(parseCampaignSettingsAiJson(valid, "SEO_SHARING").success).toBe(true);

    const missing = JSON.stringify({ schemaVersion: 1, sectionType: "SEO_SHARING", fields: { seoTitle: "Neúplné" } });
    const missingResult = parseCampaignSettingsAiJson(missing, "SEO_SHARING");
    expect(missingResult.success).toBe(false);
    if (!missingResult.success) expect(missingResult.error).toContain("AI vynechala");

    const tooLong = JSON.parse(valid) as { fields: { seoTitle: string } };
    tooLong.fields.seoTitle = "x".repeat(71);
    const tooLongResult = parseCampaignSettingsAiJson(JSON.stringify(tooLong), "SEO_SHARING");
    expect(tooLongResult.success).toBe(false);
    if (!tooLongResult.success) expect(tooLongResult.error).toContain("povolenú dĺžku");
  });
});
