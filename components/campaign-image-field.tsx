"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

type Props = {
  description: string;
  fileName: string;
  label: string;
  urlName: string;
  currentImageUrl?: string;
};

export function CampaignImageField({ description, fileName: fileInputName, label, urlName, currentImageUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const displayedImage = previewUrl ?? currentImageUrl;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selectImage(file?: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (!file) {
      setPreviewUrl(null);
      setFileName("");
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
  }

  function clearSelection() {
    if (inputRef.current) inputRef.current.value = "";
    selectImage();
  }

  return (
    <div className="md:col-span-2">
      <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">{label}</span>
      <p className="mt-1 text-xs text-[#89918b]">{description}</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        {displayedImage && (
          <div
            aria-label={previewUrl ? "Náhľad vybraného obrázka" : "Aktuálny hlavný obrázok"}
            className="h-28 w-full shrink-0 bg-[#edf0ec] bg-cover bg-center sm:w-44"
            role="img"
            style={{ backgroundImage: `url(${JSON.stringify(displayedImage)})` }}
          />
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
          <p className="mt-1 text-xs text-[#89918b]">JPG, PNG alebo WebP, najviac 5 MB.</p>
          {fileName && <p className="mt-1 max-w-sm truncate text-xs font-medium text-[#5f6a62]">{fileName}</p>}
        </div>
      </div>

      <label className="mt-5 block">
        <span className="text-xs text-[#747d76]">Alebo vložte odkaz na obrázok</span>
        <input
          className="admin-field"
          name={urlName}
          type="text"
          defaultValue={currentImageUrl ?? ""}
          placeholder="https://…"
        />
      </label>
    </div>
  );
}
