// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CampaignGalleryField } from "@/components/campaign-gallery-field";

vi.mock("@/lib/campaign-media-client", () => ({ uploadCampaignMedia: vi.fn() }));

beforeEach(() => {
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:screenshot-preview"),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function submittedItems() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[name="galleryItemData"]'))
    .map((input) => JSON.parse(input.value) as { id: string; caption: string; placement: string; sortOrder: number });
}

describe("editor médií kampane", () => {
  it("upraví popis, presunie fotografiu do sekcie a zachová iba jeden hero obrázok", () => {
    render(<CampaignGalleryField items={[
      { id: "one", mediaType: "IMAGE", mediaUrl: "/one.jpg", caption: "Prvá", placement: "GALLERY" },
      { id: "two", mediaType: "IMAGE", mediaUrl: "/two.jpg", caption: "Druhá", placement: "GALLERY" },
    ]} />);

    const captions = screen.getAllByLabelText("Popis fotografie");
    fireEvent.change(captions[0], { target: { value: "Nastavenie pohonu" } });

    const placements = screen.getAllByLabelText("Zobraziť v sekcii");
    fireEvent.change(placements[0], { target: { value: "HERO" } });
    fireEvent.change(placements[1], { target: { value: "HERO" } });

    expect(submittedItems()).toEqual([
      { id: "one", caption: "Nastavenie pohonu", placement: "GALLERY", sortOrder: 0 },
      { id: "two", caption: "Druhá", placement: "HERO", sortOrder: 1 },
    ]);
  });

  it("odstránenú fotografiu dokáže pred uložením obnoviť", () => {
    render(<CampaignGalleryField items={[
      { id: "one", mediaType: "IMAGE", mediaUrl: "/one.jpg" },
      { id: "two", mediaType: "IMAGE", mediaUrl: "/two.jpg" },
    ]} />);

    fireEvent.click(screen.getByLabelText("Odstrániť médium 1"));
    expect(submittedItems().map((item) => item.id)).toEqual(["two"]);
    fireEvent.click(screen.getByRole("button", { name: "Obnoviť odstránené (1)" }));
    expect(submittedItems().map((item) => item.id)).toEqual(["two", "one"]);
  });

  it("pridá screenshot vložený zo schránky ako novú fotografiu", () => {
    render(<CampaignGalleryField items={[]} galleryOnly />);
    const screenshot = new File(["image bytes"], "screenshot.png", { type: "image/png", lastModified: 1 });

    fireEvent.paste(screen.getByRole("button", { name: /Vložiť screenshot/ }), {
      clipboardData: {
        items: [{ kind: "file", type: "image/png", getAsFile: () => screenshot }],
      },
    });

    expect(screen.getByAltText("Fotografia 1").getAttribute("src")).toBe("blob:screenshot-preview");
    const submitted = document.querySelector<HTMLInputElement>('input[name="galleryNewItemData"]');
    expect(JSON.parse(submitted?.value ?? "null")).toMatchObject({
      caption: "",
      placement: "GALLERY",
      sortOrder: 0,
    });
  });
});
