"use client";

/* eslint-disable @next/next/no-img-element -- Admin previews need blob URLs and direct load-error handling. */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ImageOff, ImagePlus, X } from "lucide-react";
import { type PreparedCampaignMedia, uploadCampaignMedia } from "@/lib/campaign-media-client";
import {
  campaignImageSizeLabel,
  maxCampaignImageSize,
  maxFallbackUploadBatchSize,
} from "@/lib/campaign-media-limits";

type Props = {
  description: string;
  fileName: string;
  label: string;
  urlName: string;
  currentImageUrl?: string;
};

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];

export type CampaignImageFieldHandle = {
  prepareUpload: () => Promise<{ direct: boolean; item: PreparedCampaignMedia | null }>;
};

function imageSelectionError(file: File) {
  if (!allowedImageTypes.includes(file.type)) return "Vyberte obrázok vo formáte JPG, PNG alebo WebP.";
  if (file.size > maxCampaignImageSize) return `Obrázok je príliš veľký. Nahrajte súbor do ${campaignImageSizeLabel}.`;
  return "";
}

export const CampaignImageField = forwardRef<CampaignImageFieldHandle, Props>(function CampaignImageField(
  { description, fileName: fileInputName, label, urlName, currentImageUrl },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preparedUploadRef = useRef<{ key: string; item: PreparedCampaignMedia } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [failedImageUrl, setFailedImageUrl] = useState("");
  const [selectionMessage, setSelectionMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [urlValue, setUrlValue] = useState(currentImageUrl ?? "");
  const displayedImage = previewUrl ?? urlValue;
  const imageFailed = Boolean(displayedImage && failedImageUrl === displayedImage);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selectImage(file?: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (!file) {
      setPreviewUrl(null);
      setSelectedFile(null);
      setFileName("");
      setSelectionMessage("");
      preparedUploadRef.current = null;
      return;
    }

    const error = imageSelectionError(file);
    if (error) {
      setPreviewUrl(null);
      setSelectedFile(null);
      setFileName(file.name);
      setSelectionMessage(error);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
    setSelectedFile(file);
    setFileName(file.name);
    setSelectionMessage("");
    preparedUploadRef.current = null;
  }

  function clearSelection() {
    if (inputRef.current) inputRef.current.value = "";
    selectImage();
  }

  useImperativeHandle(ref, () => ({
    async prepareUpload() {
      if (!selectedFile) return { direct: true, item: null };

      const key = `${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`;
      if (preparedUploadRef.current?.key === key) {
        return { direct: true, item: preparedUploadRef.current.item };
      }

      setUploadMessage("Nahrávam originál… 0 %");
      try {
        const uploaded = await uploadCampaignMedia(selectedFile, (uploadedBytes) => {
          const percentage = Math.round((uploadedBytes / selectedFile.size) * 100);
          setUploadMessage(`Nahrávam originál… ${percentage} %`);
        });
        if (!uploaded) {
          if (selectedFile.size > maxFallbackUploadBatchSize) {
            throw new Error("Pre originálne veľké obrázky musí byť nastavené Cloudflare R2 úložisko. Lokálne nahrávanie môže mať najviac 20 MB.");
          }
          return { direct: false, item: null };
        }
        if (uploaded.mediaType !== "IMAGE") throw new Error("Úložisko vrátilo neplatný typ obrázka.");
        preparedUploadRef.current = { key, item: uploaded };
        return { direct: true, item: uploaded };
      } finally {
        setUploadMessage("");
      }
    },
  }), [selectedFile]);

  return (
    <div className="md:col-span-2">
      <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">{label}</span>
      <p className="mt-1 text-xs text-[#89918b]">{description}</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        {displayedImage && (
          <div className="relative h-28 w-full shrink-0 overflow-hidden bg-[#edf0ec] sm:w-44">
            {imageFailed ? (
              <div className="flex size-full flex-col items-center justify-center gap-1 px-4 text-center text-xs text-[#707a72]">
                <ImageOff size={18} />
                Náhľad sa nepodarilo načítať
              </div>
            ) : (
              <img
                src={displayedImage}
                alt={previewUrl ? "Náhľad vybraného obrázka" : "Aktuálny hlavný obrázok"}
                className="size-full object-cover"
                onError={() => setFailedImageUrl(displayedImage)}
              />
            )}
          </div>
        )}
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--ink)] hover:underline">
              <ImagePlus size={17} />
              {displayedImage ? "Zmeniť obrázok" : "Nahrať obrázok"}
              <input
                ref={inputRef}
                className="sr-only"
                type="file"
                name={fileInputName}
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => selectImage(event.target.files?.[0])}
              />
            </label>
            {previewUrl && (
              <button className="inline-flex items-center gap-1 text-xs text-[#707a72] hover:text-[var(--ink)]" type="button" onClick={clearSelection}>
                <X size={14} /> Zrušiť výber
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-[#89918b]">Originál bez kompresie · JPG, PNG alebo WebP do {campaignImageSizeLabel}.</p>
          {fileName && <p className="mt-1 max-w-sm truncate text-xs font-medium text-[#5f6a62]">{fileName}</p>}
          {uploadMessage && <p className="mt-2 text-xs font-medium text-[#35623d]" role="status">{uploadMessage}</p>}
          {selectionMessage && <p className="mt-2 text-xs font-medium text-[#a1433e]" role="alert">{selectionMessage}</p>}
        </div>
      </div>

      <label className="mt-5 block">
        <span className="text-xs text-[#747d76]">Alebo vložte odkaz na obrázok</span>
        <input
          className="admin-field"
          name={urlName}
          type="text"
          value={urlValue}
          onChange={(event) => setUrlValue(event.target.value)}
          placeholder="https://…"
        />
      </label>
    </div>
  );
});
