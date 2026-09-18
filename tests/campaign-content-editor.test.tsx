// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignContentEditor } from "@/components/campaign-content-editor";

vi.mock("@/components/campaign-gallery-field", async () => {
  const React = await import("react");
  const CampaignGalleryField = React.forwardRef<
    { prepareUploads: () => Promise<{ direct: boolean; items: never[] }> },
    { items: Array<{ id: string; caption?: string | null }> }
  >(function MockCampaignGalleryField({ items }, ref) {
    const [caption, setCaption] = React.useState(items[0]?.caption ?? "");
    React.useImperativeHandle(ref, () => ({ prepareUploads: async () => ({ direct: true, items: [] }) }));
    return <div>
      <label>Popis fotografie<input value={caption} onChange={(event) => setCaption(event.target.value)} /></label>
      {items[0] && <input type="hidden" name="galleryItemData" value={JSON.stringify({ id: items[0].id, caption, placement: "GALLERY", sortOrder: 0 })} />}
    </div>;
  });
  return { CampaignGalleryField };
});
vi.mock("@/components/campaign-image-field", async () => {
  const React = await import("react");
  const CampaignImageField = React.forwardRef<
    { prepareUpload: () => Promise<{ direct: boolean; item: { mediaType: "IMAGE"; mediaUrl: string } | null }> },
    Record<string, never>
  >(function MockCampaignImageField(_props, ref) {
    const [selected, setSelected] = React.useState(false);
    React.useImperativeHandle(ref, () => ({
      prepareUpload: async () => ({ direct: true, item: selected ? { mediaType: "IMAGE", mediaUrl: "/uploads/new.webp" } : null }),
    }));
    return <label>Nová fotografia<input type="checkbox" checked={selected} onChange={(event) => setSelected(event.target.checked)} /></label>;
  });
  return { CampaignImageField };
});

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

  it("po kliknutí na Hotovo zachová text aj vybranú fotografiu až do uloženia", async () => {
    const action = vi.fn(async (formData: FormData) => { void formData; });
    render(<CampaignContentEditor sections={sections} galleryItems={[]} action={action} previewHref="/preview" />);

    fireEvent.click(screen.getAllByRole("button", { name: "Upraviť" })[0]);
    fireEvent.change(screen.getByDisplayValue("Popis"), { target: { value: "Aktualizovaný popis" } });
    fireEvent.click(screen.getByLabelText("Nová fotografia"));
    fireEvent.click(screen.getAllByRole("button", { name: "Hotovo" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Uložiť obsah" }));

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const formData = action.mock.calls[0][0] as FormData;
    const submitted = JSON.parse(formData.get("campaignSections") as string) as Array<{ type: string; content: Record<string, unknown> }>;
    const hero = submitted.find((section) => section.type === "HERO");
    expect(hero?.content.description).toBe("Aktualizovaný popis");
    expect(hero?.content.imageUrl).toBe("/uploads/new.webp");
    expect(formData.get("imageUploadedMedia")).toContain("/uploads/new.webp");
  });

  it("po zatvorení galérie zachová upravený popis fotografie vo formulári", async () => {
    const action = vi.fn(async (formData: FormData) => { void formData; });
    const gallerySections = [
      ...sections,
      { id: "section_gallery", type: "GALLERY" as const, position: 2, isVisible: true, content: { heading: "Galéria", description: "Ukážky práce" } },
    ];
    const galleryItems = [{ id: "media_123", caption: "Pôvodný popis", placement: "GALLERY" }];
    render(<CampaignContentEditor sections={gallerySections} galleryItems={galleryItems as never} action={action} previewHref="/preview" />);

    fireEvent.click(screen.getAllByRole("button", { name: "Upraviť" })[2]);
    fireEvent.change(screen.getByLabelText("Popis fotografie"), { target: { value: "Nový popis fotografie" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Hotovo" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Uložiť obsah" }));

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const formData = action.mock.calls[0][0] as FormData;
    expect(formData.get("galleryEditorPresent")).toBe("1");
    expect(JSON.parse(formData.get("galleryItemData") as string).caption).toBe("Nový popis fotografie");
  });

  it("skopíruje aktuálny JSON sekcie a použije upravený JSON od AI", async () => {
    const writeText = vi.fn(async (value: string) => { void value; });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<CampaignContentEditor sections={sections} galleryItems={[]} action={vi.fn()} previewHref="/preview" />);

    fireEvent.click(screen.getAllByRole("button", { name: "Upraviť s AI" })[1]);
    fireEvent.change(screen.getByLabelText("Čo chcete zmeniť?"), { target: { value: "Skráť odpovede a zachovaj fakty." } });
    fireEvent.click(screen.getByRole("button", { name: "Kopírovať zadanie s aktuálnym JSON" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0]).toContain("Skráť odpovede a zachovaj fakty.");
    expect(writeText.mock.calls[0][0]).toContain('"heading": "Otázky"');
    expect(writeText.mock.calls[0][0]).toContain('"question": "Ako dlho?"');
    expect(screen.getByRole("status").textContent).toContain("skopírované");

    fireEvent.change(screen.getByLabelText("JSON sekcie od AI"), { target: { value: JSON.stringify({
      schemaVersion: 1,
      sectionType: "FAQ",
      content: {
        eyebrow: "Poradňa",
        heading: "Čo vás zaujíma",
        description: "Odpovede pred návštevou servisu.",
        items: [{ question: "Ako dlho trvá servis?", answer: "Termín potvrdíme po kontrole bicykla." }],
      },
    }) } });
    fireEvent.click(screen.getByRole("button", { name: "Použiť JSON v sekcii" }));

    expect(screen.getByDisplayValue("Čo vás zaujíma")).toBeTruthy();
    expect(screen.getByDisplayValue("Ako dlho trvá servis?")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Obsah z AI je použitý");
  });

  it("odmietne neúplný JSON od AI bez zmeny sekcie", () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(async () => undefined) } });
    render(<CampaignContentEditor sections={sections} galleryItems={[]} action={vi.fn()} previewHref="/preview" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Upraviť s AI" })[1]);
    fireEvent.change(screen.getByLabelText("JSON sekcie od AI"), { target: { value: '{"schemaVersion":1,"sectionType":"FAQ","content":{"heading":"Neúplné"}}' } });
    fireEvent.click(screen.getByRole("button", { name: "Použiť JSON v sekcii" }));

    expect(screen.getByRole("alert").textContent).toContain("AI vynechala");
    expect(screen.getByDisplayValue("Otázky")).toBeTruthy();
  });
});
