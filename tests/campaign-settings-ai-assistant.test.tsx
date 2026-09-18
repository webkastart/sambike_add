// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignMediaUrlField } from "@/components/campaign-media-url-field";
import { CampaignSettingsAiAssistant } from "@/components/campaign-settings-ai-assistant";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const seoJson = {
  schemaVersion: 1,
  sectionType: "SEO_SHARING",
  fields: {
    seoTitle: "Nový SEO názov",
    canonicalUrl: "https://example.com/servis",
    seoDescription: "Nový popis vo vyhľadávači.",
    ogTitle: "Nový názov pri zdieľaní",
    ogImageUrl: "/new.jpg",
    ogDescription: "Nový popis pri zdieľaní.",
    legalUrl: "/ochrana-osobnych-udajov",
    noIndex: true,
  },
};

function TestForm() {
  return (
    <form>
      <CampaignSettingsAiAssistant sectionType="SEO_SHARING" />
      <input name="seoTitle" defaultValue="Pôvodný názov" />
      <input name="canonicalUrl" defaultValue="" />
      <textarea name="seoDescription" defaultValue="Pôvodný popis" />
      <input name="ogTitle" defaultValue="" />
      <CampaignMediaUrlField label="Obrázok pri zdieľaní" name="ogImageUrl" defaultValue="/old.jpg" mediaLibrary={[]} />
      <textarea name="ogDescription" defaultValue="" />
      <input name="legalUrl" defaultValue="/ochrana-osobnych-udajov" />
      <input name="noIndex" type="checkbox" />
    </form>
  );
}

describe("AI panel nastavení kampane", () => {
  it("skopíruje opis s aktuálnymi hodnotami a aplikuje úplný JSON", async () => {
    const writeText = vi.fn(async (value: string) => { void value; });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<TestForm />);

    fireEvent.click(screen.getByText("Upraviť s AI"));
    fireEvent.change(screen.getByLabelText("Čo chcete zmeniť?"), { target: { value: "Vylepši SEO bez zmeny odkazov." } });
    fireEvent.click(screen.getByRole("button", { name: "Kopírovať zadanie s aktuálnym JSON" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0]).toContain("Vylepši SEO bez zmeny odkazov.");
    expect(writeText.mock.calls[0][0]).toContain('"seoTitle": "Pôvodný názov"');

    fireEvent.change(screen.getByLabelText("JSON od AI"), { target: { value: JSON.stringify(seoJson) } });
    fireEvent.click(screen.getByRole("button", { name: "Použiť JSON v časti" }));

    expect(document.querySelector<HTMLInputElement>('input[name="seoTitle"]')?.value).toBe("Nový SEO názov");
    expect(document.querySelector<HTMLInputElement>('input[name="ogImageUrl"]')?.value).toBe("/new.jpg");
    expect(document.querySelector<HTMLInputElement>('input[name="noIndex"]')?.checked).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("vyplnené z JSON");
  });
});
