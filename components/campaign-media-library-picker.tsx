"use client";

/* eslint-disable @next/next/no-img-element -- The picker previews user-managed local and remote media URLs. */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ImageIcon, Images, Play, Search, X } from "lucide-react";
import type { CampaignMediaLibraryItem } from "@/lib/campaign-media-library-types";

type Props = {
  items: CampaignMediaLibraryItem[];
  currentCampaignId?: string;
  mediaTypes?: Array<"IMAGE" | "VIDEO">;
  disabledUrls?: string[];
  multiple?: boolean;
  maxSelection?: number;
  label?: string;
  onSelect: (items: CampaignMediaLibraryItem[]) => void;
};

export function CampaignMediaLibraryPicker({
  items,
  currentCampaignId,
  mediaTypes = ["IMAGE", "VIDEO"],
  disabledUrls = [],
  multiple = false,
  maxSelection,
  label = "Vybrať z knižnice",
  onSelect,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const disabled = useMemo(() => new Set(disabledUrls), [disabledUrls]);
  const allowed = useMemo(() => new Set(mediaTypes), [mediaTypes]);
  const availableItems = useMemo(() => items.filter((item) => allowed.has(item.mediaType)), [allowed, items]);
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("sk");
    if (!normalized) return availableItems;
    return availableItems.filter((item) => [item.label, ...item.campaignNames, item.mediaUrl]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase("sk").includes(normalized)));
  }, [availableItems, query]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const reset = () => { setQuery(""); setSelectedUrls([]); };
    dialog.addEventListener("close", reset);
    return () => dialog.removeEventListener("close", reset);
  }, []);

  function choose(item: CampaignMediaLibraryItem) {
    if (disabled.has(item.mediaUrl)) return;
    if (!multiple) {
      onSelect([item]);
      dialogRef.current?.close();
      return;
    }
    if (!selectedUrls.includes(item.mediaUrl) && maxSelection !== undefined && selectedUrls.length >= maxSelection) return;
    setSelectedUrls((current) => current.includes(item.mediaUrl)
      ? current.filter((url) => url !== item.mediaUrl)
      : [...current, item.mediaUrl]);
  }

  function confirmSelection() {
    const selected = availableItems.filter((item) => selectedUrls.includes(item.mediaUrl));
    if (selected.length === 0) return;
    onSelect(selected);
    dialogRef.current?.close();
  }

  if (availableItems.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)] hover:underline"
      >
        <Images size={17} /> {label}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto max-h-[88vh] w-[min(68rem,calc(100%-2rem))] overflow-hidden rounded-[1.5rem] bg-white p-0 text-[var(--ink)] shadow-2xl backdrop:bg-black/45"
      >
        <div className="flex max-h-[88vh] flex-col">
          <header className="flex items-start justify-between gap-5 border-b border-[var(--line)] px-5 py-5 sm:px-7">
            <div>
              <h2 id={titleId} className="text-xl font-semibold">Knižnica médií</h2>
              <p className="mt-1 text-sm text-[#737c75]">Všetky médiá použité v kampaniach môžete použiť znova bez ďalšieho nahrávania.</p>
            </div>
            <button type="button" onClick={() => dialogRef.current?.close()} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-[#f0f2ef]" aria-label="Zavrieť knižnicu médií"><X size={18} /></button>
          </header>
          <div className="border-b border-[var(--line)] px-5 py-4 sm:px-7">
            <label className="relative block">
              <span className="sr-only">Hľadať v knižnici médií</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7b847d]" size={16} />
              <input className="admin-field mt-0 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hľadať podľa kampane alebo popisu…" />
            </label>
          </div>
          <div className="overflow-y-auto px-5 py-5 sm:px-7">
            {filteredItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {filteredItems.map((item) => {
                  const isAlreadyAdded = disabled.has(item.mediaUrl);
                  const isSelected = selectedUrls.includes(item.mediaUrl);
                  const isAtSelectionLimit = multiple && !isSelected && maxSelection !== undefined && selectedUrls.length >= maxSelection;
                  const isDisabled = isAlreadyAdded || isAtSelectionLimit;
                  const belongsToCurrentCampaign = Boolean(currentCampaignId && item.campaignIds.includes(currentCampaignId));
                  const mediaLabel = item.label || (item.mediaType === "VIDEO" ? "Video" : "Fotografia");
                  return (
                    <button
                      key={item.mediaUrl}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => choose(item)}
                      className={`group overflow-hidden rounded-xl border text-left transition ${isSelected ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20" : "border-[var(--line)] hover:border-[#87968a]"} disabled:cursor-not-allowed disabled:opacity-45`}
                      aria-pressed={multiple ? isSelected : undefined}
                    >
                      <span className="relative block aspect-[4/3] bg-[#edf0ec]">
                        {item.mediaType === "VIDEO" ? <><video src={item.mediaUrl} muted playsInline preload="metadata" className="size-full object-cover" /><span className="absolute left-1/2 top-1/2 inline-flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white"><Play size={14} fill="currentColor" /></span></> : <img src={item.mediaUrl} alt="" className="size-full object-cover" />}
                        {isSelected && <span className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-[var(--accent)] text-white"><Check size={15} /></span>}
                        {belongsToCurrentCampaign && <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">Táto kampaň</span>}
                      </span>
                      <span className="block p-3">
                        <strong className="block truncate text-xs font-semibold">{mediaLabel}</strong>
                        <span className="mt-1 block truncate text-[11px] text-[#7c857e]">{item.campaignNames.join(", ")}</span>
                        {isAlreadyAdded && <span className="mt-1 block text-[10px] font-medium text-[#657067]">Už pridané</span>}
                        {isAtSelectionLimit && <span className="mt-1 block text-[10px] font-medium text-[#657067]">Dosiahnutý limit kampane</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center text-center text-[#737c75]"><ImageIcon size={24} /><p className="mt-3 text-sm">Pre toto hľadanie sa nenašli žiadne médiá.</p></div>
            )}
          </div>
          {multiple && (
            <footer className="flex items-center justify-between gap-4 border-t border-[var(--line)] px-5 py-4 sm:px-7">
              <span className="text-xs text-[#737c75]">Vybrané: {selectedUrls.length}</span>
              <button type="button" disabled={selectedUrls.length === 0} onClick={confirmSelection} className="rounded-[3px] bg-[var(--accent-dark)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Pridať vybrané médiá</button>
            </footer>
          )}
        </div>
      </dialog>
    </>
  );
}
