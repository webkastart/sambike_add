"use client";

import { useTransition } from "react";
import { LoaderCircle, Power, Trash2 } from "lucide-react";

export function CampaignActions({
  isActive,
  toggleAction,
  deleteAction,
}: {
  isActive: boolean;
  toggleAction: () => Promise<void>;
  deleteAction: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-14 flex flex-wrap items-center gap-5 border-t border-[var(--line)] pt-6">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => toggleAction())}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#536057] hover:text-[var(--ink)] disabled:opacity-50"
      >
        {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Power size={15} />}
        {isActive ? "Deaktivovať kampaň" : "Aktivovať kampaň"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Odstrániť kampaň? Spolu s ňou odstránite aj všetkých jej záujemcov.")) {
            startTransition(() => deleteAction());
          }
        }}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#a14d49] hover:text-[#7d2e2a] disabled:opacity-50"
      >
        <Trash2 size={15} /> Odstrániť kampaň
      </button>
    </div>
  );
}
