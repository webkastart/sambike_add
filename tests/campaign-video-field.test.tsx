// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CampaignVideoField, type CampaignVideoFieldHandle } from "@/components/campaign-video-field";
import { uploadCampaignMedia } from "@/lib/campaign-media-client";

vi.mock("@/lib/campaign-media-client", () => ({
  uploadCampaignMedia: vi.fn(),
}));

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:video-preview") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("pole videa kampane", () => {
  it("ponúkne MP4 upload, zobrazí náhľad a pripraví video na uloženie", async () => {
    vi.mocked(uploadCampaignMedia).mockResolvedValue({ mediaType: "VIDEO", mediaUrl: "/uploads/promo.mp4" });
    const ref = createRef<CampaignVideoFieldHandle>();
    const { container } = render(<CampaignVideoField ref={ref} mediaLibrary={[]} onUrlChange={vi.fn()} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["video"], "promo.mp4", { type: "video/mp4" });

    expect(screen.getByText("Nahrať video")).toBeTruthy();
    expect(input.accept).toBe("video/mp4");
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("Zmeniť video")).toBeTruthy();
    expect(screen.getByLabelText("Náhľad vybraného videa")).toBeTruthy();

    let prepared: Awaited<ReturnType<CampaignVideoFieldHandle["prepareUpload"]>> | undefined;
    await act(async () => { prepared = await ref.current?.prepareUpload(); });

    expect(uploadCampaignMedia).toHaveBeenCalledWith(file, expect.any(Function));
    expect(prepared).toEqual({ direct: true, file: null, item: { mediaType: "VIDEO", mediaUrl: "/uploads/promo.mp4" } });
  });

  it("odmietne iný formát ako MP4", () => {
    const { container } = render(<CampaignVideoField mediaLibrary={[]} onUrlChange={vi.fn()} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    fireEvent.change(input, { target: { files: [new File(["video"], "promo.mov", { type: "video/quicktime" })] } });

    expect(screen.getByRole("alert").textContent).toContain("formáte MP4");
    expect(uploadCampaignMedia).not.toHaveBeenCalled();
  });
});
