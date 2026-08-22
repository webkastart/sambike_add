import Link from "next/link";
import { ArrowUpRight, Plus, Users } from "lucide-react";
import { CampaignGuide } from "@/components/campaign-guide";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; deleted?: string }>;
}) {
  const query = await searchParams;
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [campaigns, leadCount, recentLeads, leadsToday, leadsLast7Days] = await Promise.all([
    prisma.campaign.findMany({
      include: { _count: { select: { leads: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.lead.count(),
    prisma.lead.findMany({ include: { campaign: true }, orderBy: { createdAt: "desc" }, take: 4 }),
    prisma.lead.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.lead.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
  ]);
  const activeCount = campaigns.filter((campaign) => campaign.isActive).length;
  const campaignsWithLeads = campaigns.filter((campaign) => campaign._count.leads > 0).length;
  const averageLeads = activeCount > 0 ? leadCount / activeCount : 0;
  const topCampaign = [...campaigns].sort((a, b) => b._count.leads - a._count.leads)[0];
  const campaignsByPerformance = [...campaigns].sort((a, b) => b._count.leads - a._count.leads);
  const metaPixelConfigured = /^\d+$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "");
  const emailConfigured = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());

  return (
    <>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Administrácia</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Kampane</h1>
          <p className="mt-2 text-sm text-[#737c75]">Správa reklám, landing pages a nových kontaktov.</p>
        </div>
        <Link href="/admin/kampane/nova" className="inline-flex w-fit items-center gap-2 rounded-lg bg-[var(--accent-dark)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#314336]">
          <Plus size={16} /> Nová kampaň
        </Link>
      </header>

      {(query.created || query.deleted) && (
        <p className="mt-7 text-sm font-medium text-[#4e6a37]">
          {query.created ? "Kampaň bola vytvorená." : "Kampaň bola vymazaná."}
        </p>
      )}

      <section className="mt-11 grid grid-cols-2 gap-x-8 gap-y-9 border-y border-[var(--line)] py-8 sm:grid-cols-4">
        <div><p className="text-3xl font-semibold tracking-tight">{campaigns.length}</p><p className="mt-1 text-sm text-[#788179]">kampaní spolu</p></div>
        <div><p className="text-3xl font-semibold tracking-tight">{activeCount}</p><p className="mt-1 text-sm text-[#788179]">aktívnych</p></div>
        <div><p className="text-3xl font-semibold tracking-tight">{leadCount}</p><p className="mt-1 text-sm text-[#788179]">záujemcov spolu</p></div>
        <div><p className="text-3xl font-semibold tracking-tight">{leadsToday}</p><p className="mt-1 text-sm text-[#788179]">nových dnes</p></div>
        <div><p className="text-3xl font-semibold tracking-tight">{leadsLast7Days}</p><p className="mt-1 text-sm text-[#788179]">za 7 dní</p></div>
        <div><p className="text-3xl font-semibold tracking-tight">{campaignsWithLeads}</p><p className="mt-1 text-sm text-[#788179]">kampane so záujemcami</p></div>
        <div><p className="text-3xl font-semibold tracking-tight">{averageLeads.toLocaleString("sk-SK", { maximumFractionDigits: 1 })}</p><p className="mt-1 text-sm text-[#788179]">priemer / aktívna</p></div>
        <div>
          <p className="text-3xl font-semibold tracking-tight">{topCampaign?._count.leads ?? 0}</p>
          <p className="mt-1 truncate text-sm text-[#788179]">najviac · {topCampaign?.name ?? "—"}</p>
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-5">
          <div>
            <h2 className="text-lg font-semibold">Výkon kampaní</h2>
            <p className="mt-1 text-sm text-[#7c857e]">Podiel na všetkých získaných záujemcoch.</p>
          </div>
          <span className="hidden text-xs text-[#8a928c] sm:block">Celkový počet: {leadCount}</span>
        </div>
        <div className="mt-5 border-t border-[var(--line)]">
          {campaignsByPerformance.map((campaign) => {
            const share = leadCount > 0 ? Math.round((campaign._count.leads / leadCount) * 100) : 0;
            return (
              <div key={campaign.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 border-b border-[var(--line)] py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className={`size-1.5 shrink-0 rounded-full ${campaign.isActive ? "bg-[#7da33e]" : "bg-[#b9bfba]"}`} />
                    <Link href={`/admin/kampane/${campaign.id}`} className="truncate text-sm font-medium hover:underline">{campaign.name}</Link>
                  </div>
                  <div className="mt-3 h-1 overflow-hidden bg-[#e7ebe7]" aria-label={`${campaign.name}: ${share} % všetkých záujemcov`}>
                    <div className="h-full bg-[#81974c]" style={{ width: `${share}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{campaign._count.leads}</p>
                  <p className="text-xs text-[#8a928c]">{share} %</p>
                </div>
              </div>
            );
          })}
          {campaignsByPerformance.length === 0 && <p className="py-10 text-sm text-[#788179]">Výkon sa zobrazí po vytvorení prvej kampane.</p>}
        </div>
      </section>

      <CampaignGuide metaPixelConfigured={metaPixelConfigured} emailConfigured={emailConfigured} />

      <section className="mt-14">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Všetky kampane</h2>
          <span className="text-xs text-[#8a928c]">Verejné URL sú pripravené pre reklamy</span>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="admin-table w-full border-collapse text-left text-sm">
            <thead className="text-xs uppercase tracking-[.08em] text-[#8a928c]">
              <tr className="border-b border-[var(--line)]">
                <th className="py-3 font-medium">Kampaň</th><th className="py-3 font-medium">Stav</th><th className="py-3 font-medium">Verejná URL</th><th className="py-3 text-right font-medium">Záujemcovia</th><th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b border-[var(--line)] transition hover:bg-[#f5f7f4]">
                  <td className="py-4 pr-5">
                    <Link href={`/admin/kampane/${campaign.id}`} className="font-semibold hover:underline">{campaign.name}</Link>
                    <p className="mt-1 text-xs text-[#8a928c]">{campaign.offerType}</p>
                  </td>
                  <td className="py-4" data-label="Stav">
                    <span className="inline-flex items-center gap-2 text-xs font-medium">
                      <span className={`size-2 rounded-full ${campaign.isActive ? "bg-[#7da33e]" : "bg-[#b9bfba]"}`} />
                      {campaign.isActive ? "Aktívna" : "Neaktívna"}
                    </span>
                  </td>
                  <td className="py-4" data-label="URL">
                    <Link href={`/kampan/${campaign.slug}`} target="_blank" className="inline-flex items-center gap-1 text-[#5f6a62] hover:text-[var(--ink)]">
                      /kampan/{campaign.slug}<ArrowUpRight size={13} />
                    </Link>
                  </td>
                  <td className="py-4 text-right font-semibold" data-label="Záujemcovia">{campaign._count.leads}</td>
                  <td className="py-4 pl-4 text-right"><Link href={`/admin/kampane/${campaign.id}`} aria-label={`Upraviť ${campaign.name}`} className="text-[#8b938d] hover:text-[var(--ink)]">→</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {campaigns.length === 0 && <p className="py-12 text-center text-sm text-[#788179]">Zatiaľ tu nie je žiadna kampaň.</p>}
        </div>
      </section>

      <section className="mt-14">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Najnovší záujemcovia</h2>
          <Link href="/admin/leady" className="text-sm font-medium text-[#5e695f] hover:text-[var(--ink)]">Zobraziť všetky →</Link>
        </div>
        <div className="mt-5 divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {recentLeads.map((lead) => (
            <Link key={lead.id} href={`/admin/leady/${lead.id}`} className="grid gap-2 py-4 transition hover:pl-1 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
              <span className="font-medium">{lead.name}</span>
              <span className="text-sm text-[#727c74]">{lead.campaign.name}</span>
              <span className="text-xs text-[#929a94]">{formatDate(lead.createdAt)}</span>
            </Link>
          ))}
          {recentLeads.length === 0 && <div className="flex items-center gap-2 py-9 text-sm text-[#788179]"><Users size={16} /> Prví záujemcovia sa zobrazia tu.</div>}
        </div>
      </section>
    </>
  );
}
