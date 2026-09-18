"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FileVideo, VideoOff, X } from "lucide-react";
import { CampaignMediaLibraryPicker } from "@/components/campaign-media-library-picker";
import { type PreparedCampaignMedia, uploadCampaignMedia } from "@/lib/campaign-media-client";
import { campaignVideoSizeLabel, maxCampaignVideoSize } from "@/lib/campaign-media-limits";
import type { CampaignMediaLibraryItem } from "@/lib/campaign-media-library-types";

type Props = {
  currentCampaignId?: string;
  currentVideoUrl?: string;
  mediaLibrary?: CampaignMediaLibraryItem[];
  onUrlChange: (value: string) => void;
};

export type CampaignVideoFieldHandle = {
  prepareUpload: () => Promise<{
    direct: boolean;
    file: File | null;
    item: PreparedCampaignMedia | null;
  }>;
};

function videoSelectionError(file: File) {
  if (file.type !== "video/mp4") return "Vyberte video vo formáte MP4.";
  if (file.size > maxCampaignVideoSize) return `Video je príliš veľké. Nahrajte súbor do ${campaignVideoSizeLabel}.`;
  return "";
}

export const CampaignVideoField = forwardRef<CampaignVideoFieldHandle, Props>(function CampaignVideoField(
  { currentCampaignId, currentVideoUrl = "", mediaLibrary = [], onUrlChange },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preparedUploadRef = useRef<{ key: string; item: PreparedCampaignMedia } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [failedVideoUrl, setFailedVideoUrl] = useState("");
  const [selectionMessage, setSelectionMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const displayedVideo = previewUrl ?? currentVideoUrl;
  const videoFailed = Boolean(displayedVideo && failedVideoUrl === displayedVideo);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    setFailedVideoUrl("");
  }, [currentVideoUrl]);

  function selectVideo(file?: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (!file) {
      setPreviewUrl(null);
      setSelectedFile(null);
      setFileName("");
      setSelectionMessage("");
      preparedUploadRef.current = null;
      return;
    }

    const error = videoSelectionError(file);
    if (error) {
      setPreviewUrl(null);
      setSelectedFile(null);
      setFileName(file.name);
      setSelectionMessage(error);
      preparedUploadRef.current = null;
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
    setSelectedFile(file);
    setFileName(file.name);
    setFailedVideoUrl("");
    setSelectionMessage("");
    preparedUploadRef.current = null;
  }

  function clearSelection() {
    if (inputRef.current) inputRef.current.value = "";
    selectVideo();
  }

  function selectLibraryVideo(item: CampaignMediaLibraryItem) {
    clearSelection();
    setFailedVideoUrl("");
    setFileName(item.label || item.mediaUrl.split("/").pop() || "Video z knižnice");
    setSelectionMessage("Vybrané z knižnice médií.");
    onUrlChange(item.mediaUrl);
  }

  function updateUrl(value: string) {
    if (selectedFile) clearSelection();
    onUrlChange(value);
  }

  useImperativeHandle(ref, () => ({
    async prepareUpload() {
      if (!selectedFile) return { direct: true, file: null, item: null };

      const key = `${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`;
      if (preparedUploadRef.current?.key === key) {
        return { direct: true, file: null, item: preparedUploadRef.current.item };
      }

      setUploadMessage("Nahrávam video… 0 %");
      try {
        const uploaded = await uploadCampaignMedia(selectedFile, (uploadedBytes) => {
          const percentage = Math.round((uploadedBytes / selectedFile.size) * 100);
          setUploadMessage(`Nahrávam video… ${percentage} %`);
        });
        if (!uploaded) return { direct: false, file: selectedFile, item: null };
        if (uploaded.mediaType !== "VIDEO") throw new Error("Úložisko vrátilo neplatný typ videa.");
        preparedUploadRef.current = { key, item: uploaded };
        return { direct: true, file: null, item: uploaded };
      } finally {
        setUploadMessage("");
      }
    },
  }), [selectedFile]);

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-[.1em] text-[#747d76]">Video</span>
      <p className="mt-1 text-xs text-[#89918b]">Nahrajte MP4 súbor alebo použite video, ktoré už je v knižnici.</p>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        {displayedVideo && (
          <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-black sm:w-56">
            {videoFailed ? (
              <div className="flex size-full flex-col items-center justify-center gap-1 px-4 text-center text-xs text-[#d7ddd8]">
                <VideoOff size={18} />
                Náhľad sa nepodarilo načítať
              </div>
            ) : (
              <video
                src={displayedVideo}
                aria-label={previewUrl ? "Náhľad vybraného videa" : "Aktuálne video"}
                controls
                muted
                playsInline
                preload="metadata"
                className="size-full object-contain"
                onError={() => setFailedVideoUrl(displayedVideo)}
              />
            )}
          </div>
        )}

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--ink)] hover:underline">
              <FileVideo size={17} />
              {displayedVideo ? "Zmeniť video" : "Nahrať video"}
              <input
                ref={inputRef}
                className="sr-only"
                type="file"
                accept="video/mp4"
                onChange={(event) => selectVideo(event.target.files?.[0])}
              />
            </label>
            <CampaignMediaLibraryPicker
              items={mediaLibrary}
              currentCampaignId={currentCampaignId}
              mediaTypes={["VIDEO"]}
              onSelect={([item]) => selectLibraryVideo(item)}
            />
            {previewUrl && (
              <button className="inline-flex items-center gap-1 text-xs text-[#707a72] hover:text-[var(--ink)]" type="button" onClick={clearSelection}>
                <X size={14} /> Zrušiť výber
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-[#89918b]">Originál bez kompresie · MP4 do {campaignVideoSizeLabel}.</p>
          {fileName && <p className="mt-1 max-w-sm truncate text-xs font-medium text-[#5f6a62]">{fileName}</p>}
          {uploadMessage && <p className="mt-2 text-xs font-medium text-[#35623d]" role="status">{uploadMessage}</p>}
          {selectionMessage && <p className={`mt-2 text-xs font-medium ${selectionMessage === "Vybrané z knižnice médií." ? "text-[#35623d]" : "text-[#a1433e]"}`} role={selectionMessage === "Vybrané z knižnice médií." ? "status" : "alert"}>{selectionMessage}</p>}
        </div>
      </div>

      <label className="mt-5 block">
        <span className="text-xs text-[#747d76]">Alebo vložte priamy odkaz na video</span>
        <input
          className="admin-field"
          type="text"
          value={currentVideoUrl}
          maxLength={1000}
          onChange={(event) => updateUrl(event.target.value)}
          placeholder="https://…"
        />
      </label>
    </div>
  );
});
