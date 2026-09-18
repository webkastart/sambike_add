import { describe, expect, it } from "vitest";
import {
  campaignSectionAiPrompt,
  parseCampaignSectionAiJson,
} from "@/lib/campaign-section-ai";

describe("AI úprava sekcie kampane", () => {
  it("pripraví zadanie s normalizovaným aktuálnym obsahom", () => {
    const prompt = campaignSectionAiPrompt({
      type: "OFFER",
      content: { heading: "Jarný servis", priceText: "od 30 €", imageUrl: "/servis.jpg" },
    }, "Skráť text a zachovaj cenu.");

    expect(prompt).toContain("POŽADOVANÁ ÚPRAVA:\nSkráť text a zachovaj cenu.");
    expect(prompt).toContain('"sectionType": "OFFER"');
    expect(prompt).toContain('"heading": "Jarný servis"');
    expect(prompt).toContain('"priceText": "od 30 €"');
    expect(prompt).toContain('"imageUrl": "/servis.jpg"');
    expect(prompt).toContain('"ctaLabel": ""');
  });

  it("prijme úplný JSON aj v code fence a sanitizuje nebezpečný odkaz", () => {
    const result = parseCampaignSectionAiJson(`\`\`\`json
{"schemaVersion":1,"sectionType":"CTA","content":{"eyebrow":"Servis","heading":"Objednajte sa","description":"Ozveme sa vám.","ctaLabel":"Mám záujem","href":"javascript:alert(1)"}}
\`\`\``, "CTA");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.href).toBe("");
  });

  it("odmietne zmenu typu alebo chýbajúce polia", () => {
    expect(parseCampaignSectionAiJson('{"schemaVersion":1,"sectionType":"FORM","content":{}}', "FAQ").success).toBe(false);
    const incomplete = parseCampaignSectionAiJson('{"schemaVersion":1,"sectionType":"FAQ","content":{"heading":"Otázky"}}', "FAQ");
    expect(incomplete.success).toBe(false);
    if (!incomplete.success) expect(incomplete.error).toContain("AI vynechala");
  });
});
