import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Phone } from "lucide-react";
import { addLeadNote, anonymizeLead, retryLeadNotification, updateLeadAssignee, updateLeadFollowUp, updateLeadStatus } from "@/app/crm-actions";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { LeadStatusBadge } from "@/components/lead-status";
import { attributionSource, availableLeadStatuses, leadStatusLabels } from "@/lib/crm";
import { formatDateTimeLocal } from "@/lib/date-range";
import { formatDate, telHref } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const activityLabels = {
  CREATED: "Lead vytvorený", STATUS_CHANGED: "Zmena stavu", NOTE_ADDED: "Interná poznámka",
  FOLLOW_UP_CHANGED: "Follow-up", ASSIGNEE_CHANGED: "Zodpovedná osoba", VALUE_CHANGED: "Hodnota zákazky",
  NOTIFICATION_SENT: "Notifikácia odoslaná", NOTIFICATION_RETRIED: "Opakovanie notifikácie", ANONYMIZED: "Anonymizácia",
} as const;

export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const lead = await prisma.lead.findUnique({ where: { id }, include: {
    campaign: true,
    activities: { orderBy: { createdAt: "asc" } },
    emailOutbox: { orderBy: { createdAt: "asc" } },
  } });
  if (!lead) notFound();
  const statusAction = updateLeadStatus.bind(null, lead.id);
  const noteAction = addLeadNote.bind(null, lead.id);
  const followUpAction = updateLeadFollowUp.bind(null, lead.id);
  const assigneeAction = updateLeadAssignee.bind(null, lead.id);
  const anonymizeAction = anonymizeLead.bind(null, lead.id);

  return <>
    <Link href="/admin/leady" className="inline-flex items-center gap-2 text-sm text-[#707a72] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Späť na leady</Link>
    <header className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-[-.035em] sm:text-4xl">{lead.name}</h1><LeadStatusBadge status={lead.status} />{lead.possibleDuplicate && <span className="text-xs font-semibold text-[#9a6b25]">Možná duplicita</span>}</div><p className="mt-2 text-sm text-[#818a83]">Prijatý {formatDate(lead.createdAt)} · {attributionSource(lead)}</p></div></header>
    {query.saved && <p className="mt-6 text-sm font-medium text-[#4e6a37]" role="status">Zmena bola uložená.</p>}
    {query.error && <p className="mt-6 border-l-2 border-[#a1433e] bg-[#fff7f6] px-4 py-3 text-sm font-medium text-[#8f332f]" role="alert">{query.error}</p>}

    <section className="mt-9 grid gap-x-12 gap-y-7 border-y border-[var(--line)] py-8 sm:grid-cols-2 lg:grid-cols-4">
      <div><p className="text-xs font-semibold uppercase tracking-[.1em] text-[#8a928c]">Telefón</p>{lead.phone ? <a className="mt-2 inline-flex items-center gap-2 font-medium hover:underline" href={telHref(lead.phone)}><Phone size={16} />{lead.phone}</a> : <p className="mt-2">—</p>}</div>
      <div><p className="text-xs font-semibold uppercase tracking-[.1em] text-[#8a928c]">E-mail</p>{lead.email ? <a className="mt-2 inline-flex items-center gap-2 font-medium hover:underline" href={`mailto:${lead.email}`}><Mail size={16} />{lead.email}</a> : <p className="mt-2">—</p>}</div>
      <div><p className="text-xs font-semibold uppercase tracking-[.1em] text-[#8a928c]">Kampaň</p><Link className="mt-2 inline-flex items-center gap-2 font-medium hover:underline" href={`/admin/kampane/${lead.campaign.id}`}>{lead.campaign.name}<ExternalLink size={14} /></Link></div>
      <div><p className="text-xs font-semibold uppercase tracking-[.1em] text-[#8a928c]">Zákazka</p><p className="mt-2 font-medium">{lead.completedValueCents != null ? `${(lead.completedValueCents / 100).toLocaleString("sk-SK", { minimumFractionDigits: 2 })} ${lead.completedValueCurrency ?? "EUR"}` : "—"}</p></div>
    </section>

    <div className="mt-10 grid gap-12 lg:grid-cols-[1.05fr_.95fr]">
      <div className="space-y-10">
        <section><h2 className="text-lg font-semibold">Obchodný stav</h2><form action={statusAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label><span className="text-xs text-[#737c75]">Nový stav</span><select className="admin-field" name="status" defaultValue={lead.status}>{availableLeadStatuses(lead.status).map((status) => <option value={status} key={status}>{leadStatusLabels[status]}</option>)}</select></label>
          <label><span className="text-xs text-[#737c75]">Dôvod straty (pri LOST)</span><input className="admin-field" name="lostReason" defaultValue={lead.lostReason ?? ""} maxLength={500} /></label>
          <label><span className="text-xs text-[#737c75]">Hodnota v EUR (pri COMPLETED)</span><input className="admin-field" name="completedValue" inputMode="decimal" defaultValue={lead.completedValueCents != null ? (lead.completedValueCents / 100).toFixed(2) : ""} placeholder="0,00" /></label>
          <div className="flex items-end"><button className="rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white" type="submit">Uložiť stav</button></div>
        </form></section>

        <section><h2 className="text-lg font-semibold">Ďalší kontakt</h2><form action={followUpAction} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end"><label className="flex-1"><span className="text-xs text-[#737c75]">Dátum a čas · Europe/Bratislava</span><input className="admin-field" type="datetime-local" name="nextFollowUpAt" defaultValue={formatDateTimeLocal(lead.nextFollowUpAt)} /></label><button className="rounded-lg bg-[#edf2ee] px-4 py-2.5 text-sm font-semibold" type="submit">{lead.nextFollowUpAt ? "Uložiť / označiť vybavené" : "Nastaviť termín"}</button></form>{lead.nextFollowUpAt && <p className="mt-2 text-xs text-[#737c75]">Vymazaním hodnoty a uložením označíte follow-up ako vybavený.</p>}</section>

        <section><h2 className="text-lg font-semibold">Zodpovedná osoba</h2><form action={assigneeAction} className="mt-3 flex items-end gap-4"><label className="flex-1"><span className="sr-only">Zodpovedná osoba</span><input className="admin-field" name="assignedTo" defaultValue={lead.assignedTo ?? ""} maxLength={100} placeholder="Meno pracovníka" /></label><button className="rounded-lg bg-[#edf2ee] px-4 py-2.5 text-sm font-semibold" type="submit">Uložiť</button></form></section>

        <section><h2 className="text-lg font-semibold">Interná poznámka</h2><p className="mt-1 text-xs text-[#737c75]">Zákazník ju neuvidí; po pridaní zostane v histórii.</p><form action={noteAction} className="mt-3"><textarea className="admin-field" name="note" maxLength={2000} required /><button className="mt-3 rounded-lg bg-[#edf2ee] px-4 py-2.5 text-sm font-semibold" type="submit">Pridať poznámku</button></form></section>

        <section><h2 className="text-lg font-semibold">Časová os</h2><ol className="mt-4 border-l border-[var(--line)] pl-5">{lead.activities.map((activity) => <li key={activity.id} className="relative pb-6 last:pb-0"><span className="absolute -left-[1.47rem] top-1.5 size-2 rounded-full bg-[var(--accent)]" /><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-semibold">{activityLabels[activity.type]}</p><time className="text-xs text-[#8a928c]">{formatDate(activity.createdAt)}</time></div>{activity.fromStatus && activity.toStatus && <p className="mt-1 text-xs text-[#737c75]">{leadStatusLabels[activity.fromStatus]} → {leadStatusLabels[activity.toStatus]}</p>}{activity.message && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#48534b]">{activity.message}</p>}<p className="mt-1 text-[.7rem] text-[#9aa19b]">{activity.actor}</p></li>)}</ol></section>
      </div>

      <aside className="space-y-10">
        <section><h2 className="text-lg font-semibold">Pôvodná požiadavka</h2><p className="mt-3 whitespace-pre-wrap leading-7 text-[#48534b]">{lead.note || "Bez poznámky."}</p></section>
        <section><h2 className="text-lg font-semibold">Atribúcia</h2><dl className="mt-4 space-y-3 text-sm">{[["Zdroj", attributionSource(lead)], ["UTM source", lead.utmSource], ["UTM medium", lead.utmMedium], ["UTM campaign", lead.utmCampaign], ["UTM content", lead.utmContent], ["UTM term", lead.utmTerm], ["Landing page", lead.landingPage], ["Referrer", lead.referrer]].map(([label, value]) => <div key={label}><dt className="text-xs text-[#8a928c]">{label}</dt><dd className="mt-0.5 break-all">{value || "—"}</dd></div>)}</dl></section>
        <section><h2 className="text-lg font-semibold">E-mailové oznámenia</h2><ul className="mt-4 space-y-4 text-sm">{lead.emailOutbox.map((delivery) => <li key={delivery.id} className="border-b border-[var(--line)] pb-3 last:border-0"><div className="flex justify-between gap-4"><span>{delivery.kind === "ADMIN_NOTIFICATION" ? "Admin notifikácia" : "Potvrdenie zákazníkovi"}</span><span className="font-semibold">{delivery.status}</span></div><p className="mt-1 text-xs text-[#8a928c]">Pokusy: {delivery.attempts}{delivery.lastError ? ` · ${delivery.lastError}` : ""}</p>{delivery.status === "FAILED" && <form action={retryLeadNotification.bind(null, lead.id, delivery.id)}><button className="mt-2 rounded-lg bg-[#edf2ee] px-3 py-2 text-xs font-semibold" type="submit">Zopakovať odoslanie</button></form>}</li>)}</ul></section>
        <section className="border-t border-[var(--line)] pt-6"><h2 className="text-lg font-semibold">Ochrana osobných údajov</h2><p className="mt-2 text-sm leading-6 text-[#737c75]">Súhlas: {lead.consent ? "áno" : "nie"} · verzia {lead.consentVersion}. Auditná história zostane bez kontaktných údajov.</p>{lead.anonymizedAt ? <p className="mt-4 text-sm font-semibold">Anonymizované {formatDate(lead.anonymizedAt)}</p> : <div className="mt-4"><ConfirmActionButton action={anonymizeAction} label="Anonymizovať osobné údaje" confirmation="Naozaj anonymizovať osobné údaje? Túto zmenu nemožno vrátiť späť." /></div>}</section>
      </aside>
    </div>
  </>;
}
