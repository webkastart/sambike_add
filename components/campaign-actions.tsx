"use client";

import Link from "next/link";
import { Archive, CheckCircle2, Copy, Eye, LoaderCircle, Pause, RotateCcw, Send } from "lucide-react";
import { useTransition } from "react";

type Action = () => Promise<void>;
const labels: Record<string, string> = { DRAFT: "Koncept", READY: "Pripravená", PUBLISHED: "Publikovaná", PAUSED: "Pozastavená", ARCHIVED: "Archivovaná" };

export function CampaignActions({ status, previewHref, publishAction, readyAction, pauseAction, archiveAction, restoreDraftAction, duplicateAction }: {
  status: string; previewHref: string; publishAction: Action; readyAction: Action; pauseAction: Action; archiveAction: Action; restoreDraftAction: Action; duplicateAction: Action;
}) {
  const [pending, startTransition] = useTransition();
  const run = (action: Action) => startTransition(() => action());
  return <section className="mt-8 border-y border-[var(--line)] py-6" aria-labelledby="campaign-state-title">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a938c]">Stav kampane</p><h2 id="campaign-state-title" className="mt-1 text-xl font-semibold">{labels[status] || status}</h2></div><div className="flex flex-wrap gap-3">
      <Link href={previewHref} target="_blank" className="inline-flex items-center gap-2 rounded-[3px] border border-[var(--line)] px-4 py-2.5 text-sm font-semibold"><Eye size={15} /> Náhľad stránky</Link>
      {(status === "READY" || status === "PAUSED") && <button disabled={pending} onClick={() => { if (window.confirm("Publikovať landing page? Toto ešte nespustí Meta reklamu.")) run(publishAction); }} className="inline-flex items-center gap-2 rounded-[3px] bg-[var(--accent-dark)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Send size={15} /> Publikovať landing page</button>}
    </div></div>
    <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm">
      {status === "DRAFT" && <button disabled={pending} onClick={() => run(readyAction)} className="inline-flex items-center gap-2 font-semibold text-[#536057]"><CheckCircle2 size={15} /> Označiť ako pripravenú</button>}
      {status === "PUBLISHED" && <button disabled={pending} onClick={() => { if (window.confirm("Pozastaviť landing page? Aktívna Meta reklama sa musí najprv bezpečne pozastaviť.")) run(pauseAction); }} className="inline-flex items-center gap-2 font-semibold text-[#7a4c30]"><Pause size={15} /> Pozastaviť stránku</button>}
      {status === "ARCHIVED" && <button disabled={pending} onClick={() => run(restoreDraftAction)} className="inline-flex items-center gap-2 font-semibold"><RotateCcw size={15} /> Obnoviť do konceptu</button>}
      <button disabled={pending} onClick={() => run(duplicateAction)} className="inline-flex items-center gap-2 font-semibold text-[#536057]"><Copy size={15} /> Duplikovať kampaň</button>
      {status !== "ARCHIVED" && <button disabled={pending} onClick={() => { if (window.confirm("Archivovať kampaň? Historické leady, metriky a verzie zostanú zachované.")) run(archiveAction); }} className="inline-flex items-center gap-2 font-semibold text-[#7a4c30]"><Archive size={15} /> Archivovať</button>}
      {pending && <span className="inline-flex items-center gap-2 text-[#737c75]"><LoaderCircle className="animate-spin" size={15} /> Spracúvam…</span>}
    </div>
  </section>;
}
