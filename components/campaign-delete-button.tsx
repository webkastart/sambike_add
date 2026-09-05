"use client";

import { useTransition } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

export function CampaignDeleteButton({
  campaignName,
  leadCount,
  deleteAction,
}: {
  campaignName: string;
  leadCount: number;
  deleteAction: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const leadWarning = leadCount === 0
    ? ""
    : ` Spolu s ňou sa vymaže ${leadCount === 1 ? "aj 1 záujemca" : `aj ${leadCount} záujemcov`}.`;

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Odstrániť kampaň ${campaignName}`}
      title="Odstrániť kampaň"
      onClick={() => {
        if (window.confirm(`Naozaj odstrániť kampaň „${campaignName}“?${leadWarning} Tento krok sa nedá vrátiť.`)) {
          startTransition(() => deleteAction());
        }
      }}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-[#9a5e59] transition hover:bg-[#fff1ef] hover:text-[#7d2e2a] disabled:opacity-40"
    >
      {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
      <span>{pending ? "Odstraňujem" : "Odstrániť"}</span>
    </button>
  );
}
