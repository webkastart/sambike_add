"use client";

/* eslint-disable @next/next/no-img-element -- Admin previews need blob URLs and direct load-error handling. */

import {
  forwardRef,
  type SyntheticEvent,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ImageOff,
  ImagePlus,
  Play,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  type PreparedCampaignMedia,
  uploadCampaignMedia,
} from "@/lib/campaign-media-client";
import {
  campaignImageSizeLabel,
  campaignVideoSizeLabel,
  maxCampaignImageSize,
  maxCampaignVideoSize,
  maxFallbackUploadBatchSize,
} from "@/lib/campaign-media-limits";

type MediaType = "IMAGE" | "VIDEO";
type MediaPlacement = "HERO" | "OFFER" | "BEFORE" | "AFTER" | "GALLERY";

type GalleryItem = {
  id: string;
  mediaType: string;
  mediaUrl: string;
  caption?: string | null;
  placement?: string;
};

type CurrentItem = {
  kind: "current";
  key: string;
  id: string;
  mediaType: MediaType;
  mediaUrl: string;
  caption: string;
  placement: MediaPlacement;
};

type SelectedItem = {
  kind: "selected";
  file: File;
  key: string;
  mediaType: MediaType;
  previewUrl: string;
  caption: string;
  placement: MediaPlacement;
};

type EditorItem = CurrentItem | SelectedItem;

type Props = {
  items: GalleryItem[];
};

export type PreparedGalleryMedia = PreparedCampaignMedia & {
  caption: string;
  placement: MediaPlacement;
  sortOrder: number;
};

export type CampaignGalleryFieldHandle = {
  prepareUploads: () => Promise<{ direct: boolean; items: PreparedGalleryMedia[] }>;
};

const maxGalleryItems = 20;

const placementOptions: Array<{ value: MediaPlacement; label: string }> = [
  { value: "GALLERY", label: "Galéria" },
  { value: "HERO", label: "Úvod kampane" },
  { value: "OFFER", label: "Detail ponuky" },
  { value: "BEFORE", label: "Pred servisom" },
  { value: "AFTER", label: "Po servise" },
];

function validPlacement(value: string | undefined): MediaPlacement {
  return value === "HERO" || value === "OFFER" || value === "BEFORE" || value === "AFTER" ? value : "GALLERY";
}

function initialEditorItems(items: GalleryItem[]): EditorItem[] {
  return items.map((item) => ({
    kind: "current",
    key: `current-${item.id}`,
    id: item.id,
    mediaType: item.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
    mediaUrl: item.mediaUrl,
    caption: item.caption ?? "",
    placement: item.mediaType === "VIDEO" ? "GALLERY" : validPlacement(item.placement),
  }));
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function fileMediaType(file: File): MediaType | null {
  if (["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= maxCampaignImageSize) return "IMAGE";
  if (file.type === "video/mp4" && file.size <= maxCampaignVideoSize) return "VIDEO";
  return null;
}

function fileRejection(file: File) {
  if (["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return file.size > maxCampaignImageSize ? `${file.name}: obrázok môže mať najviac ${campaignImageSizeLabel}.` : "";
  }
  if (file.type === "video/mp4") {
    return file.size > maxCampaignVideoSize ? `${file.name}: MP4 video môže mať najviac ${campaignVideoSizeLabel}.` : "";
  }
  return `${file.name}: podporované sú iba JPG, PNG, WebP alebo MP4.`;
}

function uniqueMessages(messages: string[]) {
  return [...new Set(messages.filter(Boolean))].slice(0, 3).join(" ");
}

function loadVideoPreview(event: SyntheticEvent<HTMLVideoElement>) {
  const video = event.currentTarget;
  if (!Number.isFinite(video.duration) || video.duration <= 0) return;
  video.currentTime = Math.min(0.1, video.duration / 2);
}

function MediaPreview({ label, mediaType, src }: { label: string; mediaType: string; src: string }) {
  const [failedSrc, setFailedSrc] = useState("");
  const failed = failedSrc === src;

  if (failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center text-xs text-[#707a72]">
        <ImageOff size={18} />
        Súbor sa nepodarilo načítať
      </div>
    );
  }

  if (mediaType === "VIDEO") {
    return (
      <>
        <video
          src={src}
          aria-label={label}
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full object-cover"
          onLoadedMetadata={loadVideoPreview}
          onError={() => setFailedSrc(src)}
        />
        <span className="pointer-events-none absolute left-1/2 top-1/2 inline-flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white">
          <Play size={16} fill="currentColor" />
        </span>
      </>
    );
  }

  return <img src={src} alt={label} className="absolute inset-0 size-full object-cover" onError={() => setFailedSrc(src)} />;
}

export const CampaignGalleryField = forwardRef<CampaignGalleryFieldHandle, Props>(function CampaignGalleryField({ items }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef(new Set<string>());
  const preparedUploadsRef = useRef(new Map<string, PreparedCampaignMedia>());
  const [editorItems, setEditorItems] = useState<EditorItem[]>(() => initialEditorItems(items));
  const [removedItems, setRemovedItems] = useState<CurrentItem[]>([]);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function syncInputFiles(nextItems: EditorItem[]) {
    if (!inputRef.current || typeof DataTransfer === "undefined") return;
    const transfer = new DataTransfer();
    nextItems.forEach((item) => {
      if (item.kind === "selected") transfer.items.add(item.file);
    });
    inputRef.current.files = transfer.files;
  }

  function commitItems(nextItems: EditorItem[]) {
    setEditorItems(nextItems);
    syncInputFiles(nextItems);
  }

  function addItems(files: FileList | null) {
    if (!files) return;
    const selectedKeys = new Set(editorItems.filter((item): item is SelectedItem => item.kind === "selected").map(({ key }) => key));
    const availablePlaces = Math.max(0, maxGalleryItems - editorItems.length);
    const candidates = Array.from(files).filter((file) => !selectedKeys.has(fileKey(file)));
    const additions: SelectedItem[] = [];
    const errors: string[] = [];

    for (const file of candidates) {
      const rejection = fileRejection(file);
      if (rejection) {
        errors.push(rejection);
        continue;
      }
      const mediaType = fileMediaType(file);
      if (!mediaType) continue;
      if (additions.length >= availablePlaces) {
        errors.push(`Kampaň môže obsahovať najviac ${maxGalleryItems} médií.`);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      additions.push({
        kind: "selected",
        file,
        key: fileKey(file),
        mediaType,
        previewUrl,
        caption: "",
        placement: "GALLERY",
      });
    }

    setSelectionMessage(uniqueMessages(errors));
    commitItems([...editorItems, ...additions]);
  }

  function removeItem(item: EditorItem) {
    if (item.kind === "selected") {
      URL.revokeObjectURL(item.previewUrl);
      previewUrlsRef.current.delete(item.previewUrl);
      preparedUploadsRef.current.delete(item.key);
    } else {
      setRemovedItems((removed) => [...removed, item]);
    }
    commitItems(editorItems.filter(({ key }) => key !== item.key));
    setSelectionMessage("");
  }

  function restoreRemovedItems() {
    const occupiedPlacements = new Set<MediaPlacement>(editorItems.map((item) => item.placement).filter((placement) => placement !== "GALLERY"));
    const restoredItems = removedItems.map((item) => {
      if (item.placement === "GALLERY" || !occupiedPlacements.has(item.placement)) {
        occupiedPlacements.add(item.placement);
        return item;
      }
      return { ...item, placement: "GALLERY" as const };
    });
    commitItems([...editorItems, ...restoredItems]);
    setRemovedItems([]);
  }

  function updateItem(key: string, update: Partial<Pick<EditorItem, "caption" | "placement">>) {
    commitItems(editorItems.map((item) => {
      if (item.key !== key) {
        if (update.placement && update.placement !== "GALLERY" && item.placement === update.placement) {
          return { ...item, placement: "GALLERY" };
        }
        return item;
      }
      const placement = item.mediaType === "VIDEO" ? "GALLERY" : (update.placement ?? item.placement);
      return { ...item, ...update, placement };
    }));
  }

  function moveItem(index: number, offset: -1 | 1) {
    const destination = index + offset;
    if (destination < 0 || destination >= editorItems.length) return;
    const nextItems = [...editorItems];
    [nextItems[index], nextItems[destination]] = [nextItems[destination], nextItems[index]];
    commitItems(nextItems);
  }

  useImperativeHandle(ref, () => ({
    async prepareUploads() {
      const selectedItems = editorItems
        .map((item, sortOrder) => ({ item, sortOrder }))
        .filter((entry): entry is { item: SelectedItem; sortOrder: number } => entry.item.kind === "selected");
      if (selectedItems.length === 0) return { direct: true, items: [] };

      const totalSize = selectedItems.reduce((total, { item }) => total + item.file.size, 0);
      let uploadedBeforeCurrent = 0;
      const prepared: PreparedGalleryMedia[] = [];
      setUploadMessage("Nahrávam súbory… 0 %");
      try {
        for (const { item, sortOrder } of selectedItems) {
          let uploaded = preparedUploadsRef.current.get(item.key);
          if (!uploaded) {
            uploaded = await uploadCampaignMedia(item.file, (uploadedBytes) => {
              const percentage = Math.round(((uploadedBeforeCurrent + uploadedBytes) / totalSize) * 100);
              setUploadMessage(`Nahrávam súbory… ${percentage} %`);
            }) ?? undefined;
          }
          if (!uploaded) {
            setUploadMessage("");
            if (totalSize > maxFallbackUploadBatchSize) {
              throw new Error("Pre originálne veľké súbory musí byť nastavené Cloudflare R2 úložisko. Lokálne nahrávanie môže mať naraz najviac 20 MB.");
            }
            return { direct: false, items: [] };
          }
          preparedUploadsRef.current.set(item.key, uploaded);
          prepared.push({ ...uploaded, caption: item.caption.trim(), placement: item.placement, sortOrder });
          uploadedBeforeCurrent += item.file.size;
        }
        setUploadMessage("");
        return { direct: true, items: prepared };
      } catch (error) {
        setUploadMessage("");
        throw error;
      }
    },
  }), [editorItems]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Médiá kampane</span>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#89918b]">
            Ku každej fotke môžete doplniť popis, určiť jej miesto na stránke, zmeniť poradie alebo ju odstrániť.
          </p>
        </div>
        <span className="text-xs font-medium text-[#747d76]" aria-live="polite">{editorItems.length} / {maxGalleryItems} médií</span>
      </div>

      {editorItems.length > 0 ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {editorItems.map((item, index) => {
            const src = item.kind === "current" ? item.mediaUrl : item.previewUrl;
            const itemData = {
              ...(item.kind === "current" ? { id: item.id } : { key: item.key }),
              caption: item.caption,
              placement: item.placement,
              sortOrder: index,
            };
            return (
              <div key={item.key} className="overflow-hidden rounded-[1.25rem] border border-[var(--line)] bg-white">
                {item.kind === "current" ? (
                  <input type="hidden" name="galleryItemData" value={JSON.stringify(itemData)} />
                ) : (
                  <input type="hidden" name="galleryNewItemData" value={JSON.stringify(itemData)} />
                )}
                <div className="relative aspect-[16/10] bg-[#edf0ec]">
                  <MediaPreview
                    src={src}
                    mediaType={item.mediaType}
                    label={item.caption || `${item.mediaType === "VIDEO" ? "Video" : "Fotografia"} ${index + 1}`}
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-white">
                    {item.kind === "selected" ? "Nové · " : ""}{item.mediaType === "VIDEO" ? "Video" : String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className="space-y-4 p-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-[#59635b]">Popis fotografie</span>
                    <input
                      className="admin-field"
                      type="text"
                      value={item.caption}
                      maxLength={240}
                      placeholder="Napr. Kontrola a nastavenie pohonu"
                      onChange={(event) => updateItem(item.key, { caption: event.target.value })}
                    />
                  </label>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                    <label>
                      <span className="text-xs font-semibold text-[#59635b]">Zobraziť v sekcii</span>
                      <select
                        className="admin-field"
                        value={item.placement}
                        disabled={item.mediaType === "VIDEO"}
                        onChange={(event) => updateItem(item.key, { placement: event.target.value as MediaPlacement })}
                      >
                        {placementOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <div className="flex items-center gap-1" aria-label={`Poradie média ${index + 1}`}>
                      <button
                        type="button"
                        onClick={() => moveItem(index, -1)}
                        disabled={index === 0}
                        className="inline-flex size-9 items-center justify-center rounded-full text-[#59635b] hover:bg-[#f0f2ef] disabled:opacity-25"
                        aria-label="Posunúť vyššie"
                      ><ArrowUp size={16} /></button>
                      <button
                        type="button"
                        onClick={() => moveItem(index, 1)}
                        disabled={index === editorItems.length - 1}
                        className="inline-flex size-9 items-center justify-center rounded-full text-[#59635b] hover:bg-[#f0f2ef] disabled:opacity-25"
                        aria-label="Posunúť nižšie"
                      ><ArrowDown size={16} /></button>
                      <button
                        type="button"
                        onClick={() => removeItem(item)}
                        className="inline-flex size-9 items-center justify-center rounded-full text-[#9a4540] hover:bg-[#fff2f1]"
                        aria-label={`Odstrániť médium ${index + 1}`}
                      ><Trash2 size={16} /></button>
                    </div>
                  </div>
                  {item.mediaType === "VIDEO" && <p className="text-xs text-[#89918b]">Video sa zobrazuje v galérii, kde má vlastné ovládanie prehrávania.</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 border-y border-[var(--line)] py-5 text-sm text-[#747d76]">
          Zatiaľ tu nie sú ďalšie médiá. Nahrajte fotografie alebo videá a vyberte, kde sa majú zobraziť.
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <label className={`inline-flex items-center gap-2 text-sm font-semibold ${editorItems.length >= maxGalleryItems ? "cursor-not-allowed text-[#a4aaa5]" : "cursor-pointer text-[var(--ink)] hover:underline"}`} aria-disabled={editorItems.length >= maxGalleryItems}>
          <ImagePlus size={17} />
          {editorItems.length > 0 ? "Pridať ďalšie médiá" : "Nahrať fotky a videá"}
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            name="galleryMediaFiles"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            multiple
            aria-disabled={editorItems.length >= maxGalleryItems}
            onClick={(event) => { if (editorItems.length >= maxGalleryItems) event.preventDefault(); }}
            onChange={(event) => addItems(event.target.files)}
          />
        </label>
        {removedItems.length > 0 && (
          <button type="button" onClick={restoreRemovedItems} className="inline-flex items-center gap-1.5 text-xs text-[#707a72] hover:text-[var(--ink)]">
            <RotateCcw size={14} /> Obnoviť odstránené ({removedItems.length})
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-[#89918b]">
        Pre každú špeciálnu sekciu možno vybrať po jednej fotografii · JPG, PNG alebo WebP do {campaignImageSizeLabel}; MP4 do {campaignVideoSizeLabel}.
      </p>
      {uploadMessage && <p className="mt-2 text-xs font-medium text-[#35623d]" role="status">{uploadMessage}</p>}
      {selectionMessage && <p className="mt-2 text-xs font-medium text-[#9b5b23]" role="status">{selectionMessage}</p>}
    </div>
  );
});
