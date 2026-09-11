"use client";

/* eslint-disable @next/next/no-img-element -- Admin previews need blob URLs and direct load-error handling. */

import { forwardRef, type SyntheticEvent, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ImageOff, ImagePlus, Play, RotateCcw, Trash2 } from "lucide-react";
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

type GalleryItem = {
  id: string;
  mediaType: string;
  mediaUrl: string;
};

type SelectedItem = {
  file: File;
  key: string;
  mediaType: MediaType;
  previewUrl: string;
};

type Props = {
  items: GalleryItem[];
};

export type PreparedGalleryMedia = PreparedCampaignMedia;

export type CampaignGalleryFieldHandle = {
  prepareUploads: () => Promise<{ direct: boolean; items: PreparedGalleryMedia[] }>;
};

const maxGalleryItems = 20;

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

  // A frame at exactly 0 s is not painted reliably by Safari and Chromium.
  // Seeking slightly forward makes the browser fetch and render a real preview.
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

  return (
    <img
      src={src}
      alt={label}
      className="absolute inset-0 size-full object-cover"
      onError={() => setFailedSrc(src)}
    />
  );
}

export const CampaignGalleryField = forwardRef<CampaignGalleryFieldHandle, Props>(function CampaignGalleryField({ items }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef(new Set<string>());
  const preparedUploadsRef = useRef(new Map<string, PreparedGalleryMedia>());
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");

  const visibleItems = items.filter((item) => !removedIds.includes(item.id));
  const itemCount = visibleItems.length + selectedItems.length;

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function syncInputFiles(nextItems: SelectedItem[]) {
    if (!inputRef.current) return;
    const transfer = new DataTransfer();
    nextItems.forEach(({ file }) => transfer.items.add(file));
    inputRef.current.files = transfer.files;
  }

  function addItems(files: FileList | null) {
    if (!files) return;

    const selectedKeys = new Set(selectedItems.map(({ key }) => key));
    const availablePlaces = Math.max(0, maxGalleryItems - itemCount);
    const candidates = Array.from(files).filter((file) => !selectedKeys.has(fileKey(file)));
    const nextFiles: Array<{ file: File; mediaType: MediaType }> = [];
    const errors: string[] = [];

    for (const file of candidates) {
      const rejection = fileRejection(file);
      if (rejection) {
        errors.push(rejection);
        continue;
      }
      const mediaType = fileMediaType(file);
      if (!mediaType) continue;
      if (nextFiles.length >= availablePlaces) {
        errors.push(`Galéria môže obsahovať najviac ${maxGalleryItems} položiek.`);
        continue;
      }
      nextFiles.push({ file, mediaType });
    }
    setSelectionMessage(uniqueMessages(errors));
    const additions = nextFiles.map(({ file, mediaType }) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      return { file, key: fileKey(file), mediaType, previewUrl };
    });
    const nextItems = [...selectedItems, ...additions];

    setSelectedItems(nextItems);
    syncInputFiles(nextItems);
  }

  function removeSelectedItem(key: string) {
    const removedItem = selectedItems.find((item) => item.key === key);
    if (removedItem) {
      URL.revokeObjectURL(removedItem.previewUrl);
      previewUrlsRef.current.delete(removedItem.previewUrl);
    }
    const nextItems = selectedItems.filter((item) => item.key !== key);
    preparedUploadsRef.current.delete(key);
    setSelectedItems(nextItems);
    setSelectionMessage("");
    syncInputFiles(nextItems);
  }

  useImperativeHandle(ref, () => ({
    async prepareUploads() {
      if (selectedItems.length === 0) return { direct: true, items: [] };

      const totalSize = selectedItems.reduce((total, item) => total + item.file.size, 0);
      let uploadedBeforeCurrent = 0;
      const prepared: PreparedGalleryMedia[] = [];
      setUploadMessage("Nahrávam súbory… 0 %");
      try {
        for (const item of selectedItems) {
          const cached = preparedUploadsRef.current.get(item.key);
          if (cached) {
            prepared.push(cached);
            uploadedBeforeCurrent += item.file.size;
            continue;
          }

          const uploaded = await uploadCampaignMedia(item.file, (uploadedBytes) => {
            const percentage = Math.round(((uploadedBeforeCurrent + uploadedBytes) / totalSize) * 100);
            setUploadMessage(`Nahrávam súbory… ${percentage} %`);
          });
          if (!uploaded) {
            setUploadMessage("");
            if (totalSize > maxFallbackUploadBatchSize) {
              throw new Error("Pre originálne veľké súbory musí byť nastavené Cloudflare R2 úložisko. Lokálne nahrávanie môže mať naraz najviac 20 MB.");
            }
            return { direct: false, items: [] };
          }
          preparedUploadsRef.current.set(item.key, uploaded);
          prepared.push(uploaded);
          uploadedBeforeCurrent += item.file.size;
        }
        setUploadMessage("");
        return { direct: true, items: prepared };
      } catch (error) {
        setUploadMessage("");
        throw error;
      }
    },
  }), [selectedItems]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Galéria kampane</span>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#89918b]">
            Vyberte fotografie aj MP4 videá. Na stránke sa automaticky zoradia za sebou a prispôsobia mobilu aj počítaču.
          </p>
        </div>
        <span className="text-xs font-medium text-[#747d76]" aria-live="polite">
          {itemCount} / {maxGalleryItems} položiek
        </span>
      </div>

      {itemCount > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleItems.map((item, index) => (
            <div key={item.id} className="group relative aspect-[4/3] overflow-hidden rounded-[4px] bg-[#edf0ec]">
              <input type="hidden" name="galleryItemId" value={item.id} />
              <MediaPreview
                src={item.mediaUrl}
                mediaType={item.mediaType}
                label={`${item.mediaType === "VIDEO" ? "Video" : "Fotografia"} galérie ${index + 1}`}
              />
              <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white">
                {item.mediaType === "VIDEO" ? "Video" : index + 1}
              </span>
              <button
                type="button"
                onClick={() => setRemovedIds((ids) => [...ids, item.id])}
                className="absolute bottom-2 right-2 inline-flex size-8 items-center justify-center rounded-full bg-white text-[#793b37] shadow-sm transition hover:bg-[#fff2f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                aria-label={`Odstrániť položku ${index + 1}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          {selectedItems.map((item, index) => (
            <div key={item.key} className="relative aspect-[4/3] overflow-hidden rounded-[4px] bg-[#edf0ec]">
              <MediaPreview src={item.previewUrl} mediaType={item.mediaType} label={`Náhľad nového súboru ${index + 1}`} />
              <span className="absolute left-2 top-2 rounded-full bg-[var(--accent)] px-2 py-1 text-[10px] font-semibold text-white">
                {item.mediaType === "VIDEO" ? "Nové video" : "Nová fotka"}
              </span>
              <button
                type="button"
                onClick={() => removeSelectedItem(item.key)}
                className="absolute bottom-2 right-2 inline-flex size-8 items-center justify-center rounded-full bg-white text-[#793b37] shadow-sm transition hover:bg-[#fff2f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                aria-label={`Zrušiť výber súboru ${item.file.name}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 border-y border-[var(--line)] py-5 text-sm text-[#747d76]">
          Galéria je prázdna. Po nahratí sa fotografie a videá zobrazia v časti „Práca zo servisu“.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label
          className={`inline-flex items-center gap-2 text-sm font-semibold ${
            itemCount >= maxGalleryItems ? "cursor-not-allowed text-[#a4aaa5]" : "cursor-pointer text-[var(--ink)] hover:underline"
          }`}
          aria-disabled={itemCount >= maxGalleryItems}
        >
          <ImagePlus size={17} />
          {itemCount > 0 ? "Pridať ďalšie súbory" : "Nahrať fotky a videá"}
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            name="galleryMediaFiles"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            multiple
            aria-disabled={itemCount >= maxGalleryItems}
            onClick={(event) => {
              if (itemCount >= maxGalleryItems) event.preventDefault();
            }}
            onChange={(event) => addItems(event.target.files)}
          />
        </label>
        {removedIds.length > 0 && (
          <button
            type="button"
            onClick={() => setRemovedIds([])}
            className="inline-flex items-center gap-1.5 text-xs text-[#707a72] hover:text-[var(--ink)]"
          >
            <RotateCcw size={14} /> Obnoviť odstránené
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-[#89918b]">
        Originály bez kompresie · JPG, PNG alebo WebP do {campaignImageSizeLabel}; MP4 do {campaignVideoSizeLabel}.
      </p>
      {uploadMessage && <p className="mt-2 text-xs font-medium text-[#35623d]" role="status">{uploadMessage}</p>}
      {selectionMessage && <p className="mt-2 text-xs font-medium text-[#9b5b23]" role="status">{selectionMessage}</p>}
    </div>
  );
});
