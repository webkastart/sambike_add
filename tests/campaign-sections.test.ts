import { describe, expect, it } from "vitest";
import {
  legacyCampaignSections,
  parseCampaignSections,
  resolveCampaignSections,
  sanitizeSectionContent,
} from "@/lib/campaign-sections";

const legacyCampaign = {
  id: "campaign_123",
  name: "Jarný servis",
  headline: "Bicykel pripravený na sezónu",
  description: "Kompletná kontrola a nastavenie bicykla.",
  imageUrl: "/hero.jpg",
  offerImageUrl: "/offer.jpg",
  priceText: "od 24 €",
  ctaText: "Objednať servis",
  offerType: "Servis bicyklov",
  email: "servis@example.com",
  formEnabled: true,
  benefits: [{ title: "Rýchlo", text: "Termín spolu potvrdíme." }],
  faq: [{ question: "Ako dlho?", answer: "Podľa rozsahu." }],
  testimonials: [],
  responseTimeText: "Ozveme sa do jedného dňa.",
  finalCtaText: "Pošlite požiadavku.",
  galleryItems: [{ mediaType: "IMAGE", placement: "GALLERY" }],
};

describe("modulárne sekcie kampane", () => {
  it("vytvorí spätne kompatibilné sekcie z existujúcej kampane", () => {
    const sections = legacyCampaignSections(legacyCampaign);
    expect(sections.map((section) => section.type)).toEqual(["HERO", "BENEFITS", "OFFER", "FORM", "GALLERY", "FAQ", "TESTIMONIALS", "CTA"]);
    expect(sections.find((section) => section.type === "HERO")?.content.heading).toBe("Bicykel pripravený na sezónu");
    expect(sections.find((section) => section.type === "FORM")?.isVisible).toBe(true);
  });

  it("uprednostní uložené poradie a viditeľnosť", () => {
    const resolved = resolveCampaignSections({
      ...legacyCampaign,
      sections: [
        { id: "section_offer", type: "OFFER", position: 1, isVisible: false, content: { heading: "Ponuka" } },
        { id: "section_hero", type: "HERO", position: 0, isVisible: true, content: { heading: "Úvod" } },
      ],
    });
    expect(resolved.map((section) => section.id)).toEqual(["section_hero", "section_offer"]);
    expect(resolved[1].isVisible).toBe(false);
  });

  it("validuje, zoradí a oreže obsah odoslaný adminom", () => {
    const input = JSON.stringify([
      { id: "section_hero", type: "HERO", isVisible: true, content: { heading: "A".repeat(250), description: "Popis", ctaLabel: "Mám záujem" } },
      { id: "section_faq", type: "FAQ", isVisible: false, content: { items: [{ question: "Otázka", answer: "Odpoveď" }] } },
    ]);
    const sections = parseCampaignSections(input);
    expect(sections?.map((section) => section.position)).toEqual([0, 1]);
    expect((sections?.[0].content.heading as string).length).toBe(180);
    expect(sections?.[1].isVisible).toBe(false);
  });

  it("odstráni nebezpečný odkaz z CTA", () => {
    expect(sanitizeSectionContent("CTA", { heading: "Kliknite", href: "javascript:alert(1)" }).href).toBe("");
    expect(sanitizeSectionContent("CTA", { heading: "Kliknite", href: "#mam-zaujem" }).href).toBe("#mam-zaujem");
  });
});
