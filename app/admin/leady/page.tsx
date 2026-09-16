import Link from "next/link";
import { Download, Filter, Search } from "lucide-react";
import { LeadStatusBadge } from "@/components/lead-status";
import { leadStatuses, leadStatusLabels } from "@/lib/crm";
import { bratislavaDateKey } from "@/lib/date-range";
import { formatDate } from "@/lib/format";
import { leadListQuery, leadQueryString, leadsPerPage, type LeadSearchParams } from "@/lib/lead-query";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<LeadSearchParams> }) {
  const params = await searchParams;
  const { where, orderBy, page } = leadListQuery(params);
  const [campaigns, leads, total, statusGroups] = await Promise.all([
    prisma.campaign.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.lead.findMany({ where, include: { campaign: { select: { name: true } } }, orderBy, skip: (page - 1) * leadsPerPage, take: leadsPerPage }),
    prisma.lead.count({ where }),
    prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / leadsPerPage));
  const counts = Object.fromEntries(statusGroups.map((item) => [item.status, item._count._all]));
  const exportQuery = leadQueryString(params, { strana: undefined });
  const now = new Date();

  return <>
    <header><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Interné CRM</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Leady</h1><p className="mt-2 text-sm text-[#737c75]">Pracovný zoznam požiadaviek, follow-upov a obchodných výsledkov.</p></header>

    <nav className="mt-7 flex gap-4 overflow-x-auto border-b border-[var(--line)] pb-3 text-sm" aria-label="Počty podľa stavu">
      {leadStatuses.map((status) => <Link key={status} href={`/admin/leady?${leadQueryString(params, { stav: status, strana: undefined })}`} className="whitespace-nowrap text-[#667168] hover:text-[var(--ink)]"><strong className="text-[var(--ink)]">{counts[status] ?? 0}</strong> {leadStatusLabels[status]}</Link>)}
    </nav>

    <form className="mt-7 grid gap-3 border-b border-[var(--line)] pb-5 md:grid-cols-4" method="get">
      <label className="relative md:col-span-2"><Search className="absolute left-0 top-3 text-[#8a928c]" size={15} /><span className="sr-only">Hľadať</span><input className="admin-field pl-6" name="q" defaultValue={params.q} placeholder="Meno, telefón alebo e-mail" /></label>
      <label><span className="sr-only">Kampaň</span><select className="admin-field" name="kampan" defaultValue={params.kampan ?? ""}><option value="">Všetky kampane</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
      <label><span className="sr-only">Stav</span><select className="admin-field" name="stav" defaultValue={params.stav ?? ""}><option value="">Všetky stavy</option>{leadStatuses.map((status) => <option key={status} value={status}>{leadStatusLabels[status]}</option>)}</select></label>
      <label><span className="sr-only">Zdroj alebo UTM</span><input className="admin-field" name="zdroj" defaultValue={params.zdroj} placeholder="Zdroj / UTM" /></label>
      <label><span className="sr-only">Od dátumu</span><input className="admin-field" type="date" name="od" defaultValue={params.od} /></label>
      <label><span className="sr-only">Do dátumu</span><input className="admin-field" type="date" name="do" defaultValue={params.do} max={bratislavaDateKey(now)} /></label>
      <label><span className="sr-only">Kontakt</span><select className="admin-field" name="kontakt" defaultValue={params.kontakt ?? ""}><option value="">Všetky kontakty</option><option value="potrebuje">Potrebuje kontakt</option><option value="po-termine">Kontakt po termíne</option></select></label>
      <label><span className="sr-only">Triedenie</span><select className="admin-field" name="sort" defaultValue={params.sort ?? "newest"}><option value="newest">Najnovšie</option><option value="oldest">Najstaršie</option><option value="followup">Najbližší kontakt</option></select></label>
      <div className="flex items-center gap-4 md:col-span-4"><button className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white" type="submit"><Filter size={15} /> Použiť filtre</button><Link href="/admin/leady" className="text-sm text-[#727c74] hover:text-[var(--ink)]">Vyčistiť</Link><a href={`/admin/leady/export${exportQuery ? `?${exportQuery}` : ""}`} className="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-dark)]"><Download size={15} /> Export CSV</a></div>
    </form>

    <p className="mt-5 text-xs text-[#8a928c]">{total === 1 ? "1 výsledok" : `${total} výsledkov`} · strana {Math.min(page, pages)} z {pages}</p>
    <div className="mt-3 overflow-x-auto"><table className="admin-table w-full border-collapse text-left text-sm">
      <thead className="text-xs uppercase tracking-[.08em] text-[#8a928c]"><tr className="border-b border-[var(--line)]"><th className="py-3 font-medium">Lead</th><th className="py-3 font-medium">Stav</th><th className="py-3 font-medium">Kampaň</th><th className="py-3 font-medium">Ďalší krok</th><th className="py-3 text-right font-medium">Prijatý</th></tr></thead>
      <tbody>{leads.map((lead) => { const overdue = lead.nextFollowUpAt && lead.nextFollowUpAt < now; return <tr key={lead.id} className="border-b border-[var(--line)] align-top transition hover:bg-[#f5f7f4]">
        <td className="py-4 pr-4"><Link className="font-semibold hover:underline" href={`/admin/leady/${lead.id}`}>{lead.name}</Link><p className="mt-1 text-xs text-[#8a928c]">{lead.phone || "Anonymizovaný"}{lead.possibleDuplicate ? " · Možná duplicita" : ""}</p></td>
        <td className="py-4 pr-4" data-label="Stav"><LeadStatusBadge status={lead.status} /></td><td className="py-4 pr-4" data-label="Kampaň">{lead.campaign.name}</td>
        <td className={`py-4 pr-4 text-xs ${overdue ? "font-semibold text-[#9a3530]" : "text-[#667168]"}`} data-label="Ďalší krok">{lead.nextFollowUpAt ? `${overdue ? "Po termíne · " : ""}${formatDate(lead.nextFollowUpAt)}` : lead.status === "NEW" ? "Kontaktovať" : "—"}</td>
        <td className="py-4 text-right text-xs text-[#8a928c]" data-label="Prijatý">{formatDate(lead.createdAt)}</td>
      </tr>; })}</tbody>
    </table>{leads.length === 0 && <div className="py-14 text-center"><p className="text-sm font-semibold">Žiadne leady nezodpovedajú filtrom</p><p className="mt-1 text-xs text-[#788179]">Skúste zmeniť obdobie alebo vyčistiť niektorý filter.</p></div>}</div>
    {pages > 1 && <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Stránkovanie"><span>{page > 1 ? <Link href={`/admin/leady?${leadQueryString(params, { strana: page - 1 })}`}>← Predchádzajúca</Link> : null}</span><span>{page < pages ? <Link href={`/admin/leady?${leadQueryString(params, { strana: page + 1 })}`}>Ďalšia →</Link> : null}</span></nav>}
  </>;
}
