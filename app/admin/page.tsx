import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { LeadStatusBadge } from "@/components/lead-status";
import { campaignPerformance, safeRate } from "@/lib/performance";
import { bratislavaDateKey, resolvePeriod } from "@/lib/date-range";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { obdobie?: string; od?: string; do?: string };

function integer(value: number | bigint | null | undefined) { return Number(value ?? 0).toLocaleString("sk-SK"); }
function percent(value: number | null) { return value == null ? "—" : `${(value * 100).toLocaleString("sk-SK", { maximumFractionDigits: 1 })} %`; }
function money(cents: number | null) { return cents == null ? "—" : `${(cents / 100).toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`; }
function campaignStatusLabel(status: string) { return ({ DRAFT: "Koncept", READY: "Pripravená", PUBLISHED: "Publikovaná", PAUSED: "Pozastavená", ARCHIVED: "Archivovaná" } as Record<string, string>)[status] ?? status; }

export default async function AdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const period = resolvePeriod(params.obdobie, params.od, params.do);
  const today = resolvePeriod("today");
  const range = { gte: period.start, lt: period.end };
  const now = new Date();
  const [campaigns, eventGroups, leadStatuses, lifecycleGroups, revenue, completedByCampaign, followUps, metaGroups] = await Promise.all([
    prisma.campaign.findMany({ include: { metaAd: true }, orderBy: { createdAt: "desc" } }),
    prisma.campaignEvent.groupBy({ by: ["campaignId", "type"], where: { occurredAt: range }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["campaignId", "status"], where: { createdAt: range }, _count: { _all: true }, _sum: { completedValueCents: true } }),
    prisma.leadActivity.groupBy({ by: ["toStatus"], where: { createdAt: range, toStatus: { not: null } }, _count: { _all: true } }),
    prisma.lead.aggregate({ where: { status: "COMPLETED", completedAt: range }, _sum: { completedValueCents: true }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["campaignId"], where: { status: "COMPLETED", completedAt: range }, _count: { _all: true }, _sum: { completedValueCents: true } }),
    prisma.lead.findMany({ where: { status: { notIn: ["COMPLETED", "LOST", "SPAM"] }, OR: [{ status: "NEW" }, { nextFollowUpAt: { lt: today.end } }] }, include: { campaign: { select: { name: true } } }, orderBy: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }], take: 8 }),
    prisma.metaDailyMetric.groupBy({ by: ["metaAdCampaignId"], where: { date: range }, _sum: { spendCents: true, impressions: true, clicks: true, metaLeads: true } }),
  ]);
  const eventTotal = (type: string) => eventGroups.filter((row) => row.type === type).reduce((sum, row) => sum + row._count._all, 0);
  const statusTotal = (status: string) => lifecycleGroups.filter((row) => row.toStatus === status).reduce((sum, row) => sum + row._count._all, 0);
  const leads = leadStatuses.reduce((sum, row) => sum + row._count._all, 0);
  const completed = statusTotal("COMPLETED");
  const views = eventTotal("PAGE_VIEW");
  const revenueCents = revenue._sum.completedValueCents ?? 0;
  const stats = [
    ["Zobrazenia / udalosti", views], ["CTA kliknutia", eventTotal("CTA_CLICK")], ["Kliknutia na telefón", eventTotal("PHONE_CLICK")], ["Začaté formuláre", eventTotal("FORM_START")],
    ["Vytvorené leady", leads], ["Kontaktované", statusTotal("CONTACTED")], ["Dohodnuté termíny", statusTotal("BOOKED")], ["Dokončené zákazky", completed], ["Stratené leady", statusTotal("LOST")],
  ] as const;

  return <>
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Obchodný prehľad</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Výkon kampaní</h1><p className="mt-2 text-sm text-[#737c75]">Interné udalosti, leady, zákazky a Meta náklady v jednom období.</p></div><Link href="/admin/kampane/nova" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent-dark)] px-5 text-sm font-semibold text-white"><Plus size={17} /> Vytvoriť kampaň</Link></header>

    <form className="mt-8 flex flex-wrap items-end gap-4 border-b border-[var(--line)] pb-5" method="get"><label><span className="block text-xs text-[#737c75]">Obdobie</span><select className="admin-field min-w-44" name="obdobie" defaultValue={period.key}><option value="today">Dnes</option><option value="7d">Posledných 7 dní</option><option value="30d">Posledných 30 dní</option><option value="month">Tento mesiac</option><option value="custom">Vlastný rozsah</option></select></label><label><span className="block text-xs text-[#737c75]">Od</span><input className="admin-field" type="date" name="od" defaultValue={period.from} /></label><label><span className="block text-xs text-[#737c75]">Do</span><input className="admin-field" type="date" name="do" defaultValue={period.to} max={bratislavaDateKey(now)} /></label><button className="rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white" type="submit">Zobraziť</button><p className="ml-auto text-xs text-[#8a928c]">Europe/Bratislava</p></form>

    <section className="mt-8 grid grid-cols-2 border-y border-[var(--line)] md:grid-cols-3 lg:grid-cols-5" aria-label="Funnel">{stats.map(([label, value]) => <div key={label} className="border-b border-r border-[var(--line)] px-3 py-5 last:border-r-0"><p className="text-2xl font-semibold tracking-tight">{integer(value)}</p><h2 className="mt-1 text-xs leading-5 text-[#737c75]">{label}</h2></div>)}</section>
    <section className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-[#737c75]">Návšteva → lead</p><p className="mt-1 text-xl font-semibold">{percent(safeRate(leads, views))}</p></div><div><p className="text-xs text-[#737c75]">Lead → zákazka</p><p className="mt-1 text-xl font-semibold">{percent(safeRate(completed, leads))}</p></div><div><p className="text-xs text-[#737c75]">Tržba</p><p className="mt-1 text-xl font-semibold">{money(revenue._count._all ? revenueCents : null)}</p></div><div><p className="text-xs text-[#737c75]">Priemerná zákazka</p><p className="mt-1 text-xl font-semibold">{money(revenue._count._all ? Math.round(revenueCents / revenue._count._all) : null)}</p></div></section>

    <section className="mt-14"><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a938c]">Porovnanie</p><h2 className="mt-1 text-xl font-semibold">Výkon kampaní</h2></div><p className="text-xs text-[#8a928c]">Meta leady sú uvedené samostatne</p></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse text-left text-xs"><thead className="text-[#747d76]"><tr className="border-b border-[var(--line)]">{["Kampaň", "Stav", "Zobrazenia", "CTA", "Leady", "Zákazky", "Konverzia", "Tržba", "Meta spend", "Impressions", "Meta clicks", "CTR", "Meta leady", "CPL", "Cena/zákazka", "ROAS"].map((label) => <th key={label} className="whitespace-nowrap py-3 pr-4 font-medium">{label}</th>)}</tr></thead><tbody>{campaigns.map((campaign) => {
      const event = (type: string) => eventGroups.find((row) => row.campaignId === campaign.id && row.type === type)?._count._all ?? 0;
      const campaignLeads = leadStatuses.filter((row) => row.campaignId === campaign.id).reduce((sum, row) => sum + row._count._all, 0);
      const campaignCompletedRow = completedByCampaign.find((row) => row.campaignId === campaign.id);
      const campaignCompleted = campaignCompletedRow?._count._all ?? 0;
      const campaignRevenue = campaignCompletedRow?._sum.completedValueCents ?? 0;
      const meta = campaign.metaAd ? metaGroups.find((row) => row.metaAdCampaignId === campaign.metaAd!.id)?._sum : null;
      const spend = meta?.spendCents ?? null;
      const calculations = campaignPerformance({ spendCents: spend, leads: campaignLeads, completed: campaignCompleted, revenueCents: campaignRevenue });
      return <tr key={campaign.id} className="border-b border-[var(--line)]"><td className="py-4 pr-4 font-semibold"><Link className="hover:underline" href={`/admin/kampane/${campaign.id}`}>{campaign.name}</Link></td><td className="pr-4">{campaignStatusLabel(campaign.status)}</td><td className="pr-4">{integer(event("PAGE_VIEW"))}</td><td className="pr-4">{integer(event("CTA_CLICK"))}</td><td className="pr-4">{integer(campaignLeads)}</td><td className="pr-4">{integer(campaignCompleted)}</td><td className="pr-4">{percent(safeRate(campaignLeads, event("PAGE_VIEW")))}</td><td className="pr-4">{money(campaignCompleted ? campaignRevenue : null)}</td><td className="pr-4">{money(spend)}</td><td className="pr-4">{meta ? integer(meta.impressions) : "—"}</td><td className="pr-4">{meta ? integer(meta.clicks) : "—"}</td><td className="pr-4">{meta ? percent(safeRate(Number(meta.clicks), Number(meta.impressions))) : "—"}</td><td className="pr-4">{meta ? integer(meta.metaLeads) : "—"}</td><td className="pr-4">{money(calculations.cplCents)}</td><td className="pr-4">{money(calculations.costPerCompletedCents)}</td><td>{calculations.roas == null ? "—" : `${calculations.roas.toLocaleString("sk-SK", { maximumFractionDigits: 2 })}×`}</td></tr>;
    })}</tbody></table>{campaigns.length === 0 && <p className="py-10 text-center text-sm text-[#788179]">Po vytvorení kampane sa tu zobrazí jej výkon.</p>}</div></section>

    <section className="mt-14"><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a938c]">Follow-up</p><h2 className="mt-1 text-xl font-semibold">Treba kontaktovať</h2></div><Link href="/admin/leady?kontakt=potrebuje&sort=followup" className="inline-flex items-center gap-1 text-sm font-semibold">Všetky <ChevronRight size={15} /></Link></div><div className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">{followUps.map((lead) => <Link key={lead.id} href={`/admin/leady/${lead.id}`} className="grid gap-2 py-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center"><span className="font-semibold">{lead.name}</span><span className="text-sm text-[#737c75]">{lead.campaign.name}</span><LeadStatusBadge status={lead.status} /><span className={`text-xs ${lead.nextFollowUpAt && lead.nextFollowUpAt < now ? "font-semibold text-[#9a3530]" : "text-[#737c75]"}`}>{lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : "Nový lead"}</span></Link>)}{followUps.length === 0 && <p className="py-8 text-center text-sm text-[#788179]">Žiadny follow-up nie je po termíne ani naplánovaný na toto obdobie.</p>}</div></section>
  </>;
}
