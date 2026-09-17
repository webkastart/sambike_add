"use client";

import { useState } from "react";
import { CampaignMediaLibraryPicker } from "@/components/campaign-media-library-picker";
import type { CampaignMediaLibraryItem } from "@/lib/campaign-media-library-types";

type Props = {
  label: string;
  mediaLibrary: CampaignMediaLibraryItem[];
  currentCampaignId?: string;
  mediaTypes?: Array<"IMAGE" | "VIDEO">;
  name?: string;
  value?: string;
  defaultValue?: string;
  maxLength?: number;
  onChange?: (value: string) => void;
  labelClassName?: string;
};

export function CampaignMediaUrlField({
  label,
  mediaLibrary,
  currentCampaignId,
  mediaTypes,
  name,
  value,
  defaultValue = "",
  maxLength = 1000,
  onChange,
  labelClassName = "text-xs font-semibold uppercase tracking-[.1em] text-[#747d76]",
}: Props) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = value ?? internalValue;

  function update(nextValue: string) {
    setInternalValue(nextValue);
    onChange?.(nextValue);
  }

  return (
    <div>
      <label className="block">
        <span className={labelClassName}>{label}</span>
        <input
          className="admin-field"
          type="text"
          name={name}
          value={currentValue}
          maxLength={maxLength}
          onChange={(event) => update(event.target.value)}
        />
      </label>
      <div className="mt-2">
        <CampaignMediaLibraryPicker
          items={mediaLibrary}
          currentCampaignId={currentCampaignId}
          mediaTypes={mediaTypes}
          label="Vybrať z knižnice"
          onSelect={([item]) => update(item.mediaUrl)}
        />
      </div>
    </div>
  );
}
