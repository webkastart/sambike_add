import { describe, expect, it } from "vitest";
import {
  campaignAiPrompt,
  campaignJsonBooleanFields,
  type CampaignJsonDocument,
  campaignJsonStringFields,
  parseCampaignJson,
} from "@/lib/campaign-json";

function campaignDocument(): CampaignJsonDocument {
  return {
    schemaVersion: 1,
    ...Object.fromEntries(campaignJsonStringFields.map((field) => [field, `${field} value`])) as Record<(typeof campaignJsonStringFields)[number], string>,
    ...Object.fromEntries(campaignJsonBooleanFields.map((field) => [field, field === "formEnabled"])) as Record<(typeof campaignJsonBooleanFields)[number], boolean>,
    benefits: [{ title: "Rýchly termín", text: "Termín spolu vopred potvrdíme." }],
    processSteps: [{ title: "Pošlite požiadavku", text: "Ozveme sa s návrhom termínu." }],
    faq: [{ question: "Ako dlho servis trvá?", answer: "Termín potvrdíme podľa rozsahu." }],
    testimonials: [],
  };
}

describe("JSON kampane", () => {
  it("prijme úplný JSON aj v Markdown code fence", () => {
    const document = campaignDocument();
    expect(parseCampaignJson(`\`\`\`json\n${JSON.stringify(document)}\n\`\`\``)).toEqual({
      success: true,
      data: document,
    });
  });

  it("odmietne neúplnú odpoveď AI s názvom chýbajúceho poľa", () => {
    const document = campaignDocument();
    const incomplete: Record<string, unknown> = { ...document };
    delete incomplete.seoTitle;
    const result = parseCampaignJson(JSON.stringify(incomplete));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("seoTitle");
  });

  it("zadanie chráni fakty a vyžaduje čistý JSON", () => {
    const prompt = campaignAiPrompt(campaignDocument());
    expect(prompt).toContain("Nevymýšľaj si cenu");
    expect(prompt).toContain("Vráť iba jeden platný JSON objekt");
    expect(prompt).toContain('"schemaVersion": 1');
  });
});
