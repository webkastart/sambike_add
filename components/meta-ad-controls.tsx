"use client";

import { useTransition } from "react";
import { LoaderCircle, Pause, Play, RefreshCw, Trash2 } from "lucide-react";

type Action = () => Promise<void>;

export function MetaAdControls({
  active,
  startAction,
  pauseAction,
  syncAction,
  deleteAction,
}: {
  active: boolean;
  startAction: Action;
  pauseAction: Action;
  syncAction: Action;
  deleteAction: Action;
}) {
  const [pending, startTransition] = useTransition();
  const run = (action: Action) => startTransition(() => action());

  return (
    <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
      {active ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(pauseAction)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#7a4c30] disabled:opacity-50"
        >
          {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Pause size={15} />}
          Pozastaviť reklamu
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Spustiť reklamu? Meta môže od tejto chvíle míňať nastavený denný rozpočet.")) {
              run(startAction);
            }
          }}
          className="inline-flex items-center gap-2 rounded-[3px] bg-[var(--accent-dark)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#075eac] disabled:opacity-50"
        >
          {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Play size={15} />}
          Spustiť reklamu
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(syncAction)}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#59655c] hover:text-[var(--ink)] disabled:opacity-50"
      >
        <RefreshCw size={14} /> Aktualizovať výsledky
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Odstrániť túto reklamu aj z Meta Ads Managera? Výsledky uložené pri nej sa odstránia.")) {
            run(deleteAction);
          }
        }}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#a14d49] hover:text-[#7d2e2a] disabled:opacity-50"
      >
        <Trash2 size={14} /> Odstrániť
      </button>
    </div>
  );
}
