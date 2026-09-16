// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignContentEditor } from "@/components/campaign-content-editor";

vi.mock("@/components/campaign-gallery-field", () => ({ CampaignGalleryField: () => <div>Editor galérie</div> }));
vi.mock("@/components/campaign-image-field", () => ({ CampaignImageField: () => <div>Editor obrázka</div> }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const sections = [
  { id: "section_hero", type: "HERO" as const, position: 0, isVisible: true, content: { heading: "Úvod", description: "Popis", ctaLabel: "Mám záujem", imageUrl: "/hero.jpg" } },
  { id: "section_faq", type: "FAQ" as const, position: 1, isVisible: true, content: { heading: "Otázky", items: [{ question: "Ako dlho?", answer: "Jeden deň." }] } },
];

describe("editor obsahu kampane", () => {
  it("zmení poradie, viditeľnosť, pridá sekciu a odošle výsledok", async () => {
    const action = vi.fn(async (formData: FormData) => { void formData; });
    render(<CampaignContentEditor sections={sections} galleryItems={[]} action={action} previewHref="/preview" />);

    fireEvent.click(screen.getByLabelText("Posunúť sekciu Časté otázky vyššie"));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Pridať sekciu" }));
    fireEvent.click(screen.getByRole("button", { name: /Video/ }));
    fireEvent.click(screen.getByRole("button", { name: "Uložiť obsah" }));

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const submitted = JSON.parse((action.mock.calls[0][0] as FormData).get("campaignSections") as string) as Array<{ type: string; position: number; isVisible: boolean }>;
    expect(submitted.map((section) => section.type)).toEqual(["FAQ", "HERO", "VIDEO"]);
    expect(submitted[0].isVisible).toBe(false);
    expect(submitted.map((section) => section.position)).toEqual([0, 1, 2]);
  });

  it("vyžaduje potvrdenie pred odstránením sekcie", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CampaignContentEditor sections={sections} galleryItems={[]} action={vi.fn()} previewHref="/preview" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Upraviť" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Odstrániť sekciu" }));
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(screen.queryByText("Časté otázky")).toBeNull();
  });
});
