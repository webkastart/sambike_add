// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CampaignGalleryField } from "@/components/campaign-gallery-field";

vi.mock("@/lib/campaign-media-client", () => ({ uploadCampaignMedia: vi.fn() }));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(cleanup);

describe("knižnica médií kampane", () => {
  it("pridá už nahrané médium do galérie bez súborového uploadu", () => {
    render(
      <CampaignGalleryField
        items={[]}
        galleryOnly
        currentCampaignId="campaign-1"
        mediaLibrary={[{
          mediaUrl: "/uploads/service.webp",
          mediaType: "IMAGE",
          campaignIds: ["campaign-1"],
          campaignNames: ["Jarný servis"],
          label: "Servisná fotografia",
          lastUsedAt: "2026-09-17T10:00:00.000Z",
        }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pridať z knižnice" }));
    fireEvent.click(screen.getByRole("button", { name: /Servisná fotografia/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pridať vybrané médiá" }));

    const reused = document.querySelector<HTMLInputElement>('input[name="galleryLibraryMedia"]');
    expect(JSON.parse(reused?.value ?? "null")).toMatchObject({
      mediaUrl: "/uploads/service.webp",
      mediaType: "IMAGE",
      caption: "Servisná fotografia",
      placement: "GALLERY",
      sortOrder: 0,
    });
    expect(document.querySelector('input[name="galleryMediaFiles"]')).not.toBeNull();
    expect(document.querySelector('input[name="galleryNewItemData"]')).toBeNull();
  });
});
