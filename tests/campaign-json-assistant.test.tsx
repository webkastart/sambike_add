// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignJsonAssistant } from "@/components/campaign-json-assistant";
import { CampaignImageField } from "@/components/campaign-image-field";
import {
  campaignJsonBooleanFields,
  type CampaignJsonDocument,
  campaignJsonStringFields,
} from "@/lib/campaign-json";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function documentWith(values: Partial<CampaignJsonDocument> = {}): CampaignJsonDocument {
  return {
    schemaVersion: 1,
    ...Object.fromEntries(campaignJsonStringFields.map((field) => [field, `${field} text`])) as Record<(typeof campaignJsonStringFields)[number], string>,
    ...Object.fromEntries(campaignJsonBooleanFields.map((field) => [field, false])) as Record<(typeof campaignJsonBooleanFields)[number], boolean>,
    benefits: [],
    processSteps: [],
    faq: [],
    testimonials: [],
    ...values,
  };
}

function TestForm() {
  return (
    <form>
      <CampaignJsonAssistant />
      {campaignJsonStringFields.map((field) => <input key={field} name={field} defaultValue={`${field} original`} />)}
      {campaignJsonBooleanFields.map((field) => <input key={field} name={field} type="checkbox" defaultChecked={field === "formEnabled"} />)}
      <textarea name="benefits" defaultValue="Pôvodný benefit | Pôvodný text" />
      <textarea name="processSteps" defaultValue="" />
      <textarea name="faq" defaultValue="" />
      <textarea name="testimonials" defaultValue="" />
    </form>
  );
}

describe("AI JSON panel kampane", () => {
  it("skopíruje zadanie s aktuálnymi hodnotami formulára", async () => {
    const writeText = vi.fn(async (value: string) => { void value; });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<TestForm />);

    fireEvent.click(screen.getByRole("button", { name: "Kopírovať zadanie pre AI" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0]).toContain('"name": "name original"');
    expect(writeText.mock.calls[0][0]).toContain('"title": "Pôvodný benefit"');
    expect(screen.getByRole("status").textContent).toContain("skopírované");
  });

  it("vyplní texty, zoznamy aj prepínače z platného JSON", () => {
    render(<TestForm />);
    const campaign = documentWith({
      name: "Jarný servis bicyklov",
      formEnabled: true,
      noIndex: true,
      benefits: [{ title: "Bez starostí", text: "Rozsah servisu si vopred potvrdíme." }],
      faq: [{ question: "Kedy mám prísť?", answer: "Termín si dohodneme telefonicky." }],
    });

    fireEvent.change(screen.getByLabelText("JSON od AI"), { target: { value: JSON.stringify(campaign) } });
    fireEvent.click(screen.getByRole("button", { name: "Vyplniť formulár z JSON" }));

    expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe("Jarný servis bicyklov");
    expect(document.querySelector<HTMLTextAreaElement>('textarea[name="benefits"]')?.value).toBe("Bez starostí | Rozsah servisu si vopred potvrdíme.");
    expect(document.querySelector<HTMLTextAreaElement>('textarea[name="faq"]')?.value).toBe("Kedy mám prísť? | Termín si dohodneme telefonicky.");
    expect(document.querySelector<HTMLInputElement>('input[name="noIndex"]')?.checked).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Formulár je vyplnený");
  });

  it("neprepíše formulár neúplným JSON", () => {
    render(<TestForm />);
    fireEvent.change(screen.getByLabelText("JSON od AI"), { target: { value: '{"schemaVersion":1,"name":"Neúplné"}' } });
    fireEvent.click(screen.getByRole("button", { name: "Vyplniť formulár z JSON" }));

    expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe("name original");
    expect(screen.getByRole("alert").textContent).toContain("AI vynechala");
  });

  it("aktualizuje aj URL a náhľad obrázka ovládaný Reactom", () => {
    render(
      <form>
        <CampaignJsonAssistant />
        <CampaignImageField
          label="Úvodný obrázok"
          description="Náhľad"
          fileName="imageFile"
          urlName="imageUrl"
          currentImageUrl="/old.jpg"
        />
      </form>,
    );
    const campaign = documentWith({ imageUrl: "/new.jpg" });

    fireEvent.change(screen.getByLabelText("JSON od AI"), { target: { value: JSON.stringify(campaign) } });
    fireEvent.click(screen.getByRole("button", { name: "Vyplniť formulár z JSON" }));

    expect(document.querySelector<HTMLInputElement>('input[name="imageUrl"]')?.value).toBe("/new.jpg");
    expect(screen.getByAltText("Aktuálny hlavný obrázok").getAttribute("src")).toBe("/new.jpg");
  });
});
