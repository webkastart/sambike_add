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
      className="inline-flex size-8 items-center justify-center text-[#a56560] opacity-100 transition hover:text-[#7d2e2a] disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
    >
      {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
    </button>
  );
}
