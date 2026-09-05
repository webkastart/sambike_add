import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  Megaphone,
  Pencil,
  Plus,
  Target,
  Users,
} from "lucide-react";
import { deleteCampaign } from "@/app/actions";
import { CampaignDeleteButton } from "@/components/campaign-delete-button";
import { CampaignGuide } from "@/components/campaign-guide";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { getMetaConnectionSummary } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

function campaignCountLabel(count: number) {
  if (count === 1) return "1 kampaň";
  if (count >= 2 && count <= 4) return `${count} kampane`;
  return `${count} kampaní`;
}

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
  const campaignsByPerformance = [...campaigns].sort((a, b) => b._count.leads - a._count.leads);
  const topCampaign = campaignsByPerformance[0];
  const metaPixelConfigured = /^\d+$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "");
  const emailConfigured = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
  const stats = [
    {
      label: "Kampane spolu",
      value: campaigns.length,
      detail: activeCount === 1 ? "1 aktívna" : `${activeCount} aktívnych`,
      icon: Megaphone,
      tone: "text-[#1474be]",
    },
    {
      label: "Záujemcovia spolu",
      value: leadCount,
      detail: `Dnes pribudlo ${leadsToday}`,
      icon: Users,
      tone: "text-[#5f7f48]",
    },
    {
      label: "Za posledných 7 dní",
      value: leadsLast7Days,
      detail: "nových kontaktov",
      icon: CalendarDays,
      tone: "text-[#9a6b25]",
    },
    {
      label: "Priemer na aktívnu",
      value: averageLeads.toLocaleString("sk-SK", { maximumFractionDigits: 1 }),
      detail: `${campaignCountLabel(campaignsWithLeads)} s kontaktmi`,
      icon: Target,
      tone: "text-[#725f99]",
    },
  ];

  return (
    <>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Administrácia</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Kampane</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#737c75]">
            Spravujte reklamné kampane a sledujte, koľko záujemcov prinášajú.
          </p>
        </div>
        <Link
          href="/admin/kampane/nova"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-dark)] px-5 text-sm font-semibold text-white transition hover:bg-[#075eac] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:w-fit"
        >
          <Plus size={17} /> Vytvoriť kampaň
        </Link>
      </header>

      {(query.created || query.deleted) && (
        <p className="mt-6 rounded-xl bg-[#eef7e8] px-4 py-3 text-sm font-medium text-[#4e6a37]" role="status">
          {query.created ? "Kampaň bola vytvorená." : "Kampaň bola odstránená."}
        </p>
      )}

      <section className="mt-8 grid border-y border-[var(--line)] lg:grid-cols-4" aria-label="Prehľad kampaní">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label} className="flex min-w-0 items-center gap-4 border-b border-[var(--line)] py-4 last:border-b-0 lg:border-b-0 lg:border-r lg:px-6 lg:py-6 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0">
              <Icon size={22} strokeWidth={1.65} className={`shrink-0 ${stat.tone}`} aria-hidden="true" />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-semibold tracking-[-.04em] sm:text-3xl">{stat.value}</p>
                  <h2 className="truncate text-xs font-semibold text-[#505a52] sm:text-sm">{stat.label}</h2>
                </div>
                <p className="mt-0.5 truncate text-[.7rem] text-[#8a938c] sm:text-xs">{stat.detail}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section id="kampane" className="mt-12 scroll-mt-36 md:scroll-mt-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a938c]">Správa kampaní</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-.02em]">Všetky kampane</h2>
          </div>
          <p className="max-w-sm text-xs leading-5 text-[#8a938c] sm:text-right">
            Verejný odkaz môžete použiť priamo vo Facebook a Instagram reklame.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {campaigns.map((campaign) => (
            <article key={campaign.id} className="rounded-2xl border border-[#e4e8e3] bg-white p-4 transition hover:border-[#d5ddd6] sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link href={`/admin/kampane/${campaign.id}`} className="truncate text-base font-semibold hover:underline sm:text-lg">
                      {campaign.name}
                    </Link>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[.68rem] font-semibold ${campaign.isActive ? "bg-[#edf6e8] text-[#54763c]" : "bg-[#f0f1f0] text-[#747b76]"}`}>
                      <span className={`size-1.5 rounded-full ${campaign.isActive ? "bg-[#78a83f]" : "bg-[#a8afa9]"}`} />
                      {campaign.isActive ? "Aktívna" : "Neaktívna"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#8a938c]">{campaign.offerType}</p>
                </div>
                <Link
                  href={`/admin/kampane/${campaign.id}`}
                  className="hidden h-9 shrink-0 items-center gap-2 rounded-xl bg-[#f2f6f3] px-3 text-xs font-semibold text-[#4e5c52] transition hover:bg-[#e9efea] sm:inline-flex"
                >
                  <Pencil size={14} /> Upraviť
                </Link>
              </div>

              <div className="mt-5 grid gap-4 border-t border-[#edf0ed] pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-[.68rem] font-semibold uppercase tracking-[.1em] text-[#929a94]">Stránka kampane</p>
                  <Link
                    href={`/kampan/${campaign.slug}`}
                    target="_blank"
                    aria-label={`Otvoriť verejnú stránku kampane ${campaign.name}`}
                    className="group/link mt-1 inline-flex max-w-full items-center gap-2 text-sm font-semibold text-[var(--accent-dark)]"
                  >
                    <span className="truncate">/kampan/{campaign.slug}</span>
                    <ArrowUpRight size={15} className="shrink-0 transition group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" />
                  </Link>
                </div>

                <Link
                  href={`/admin/leady?kampan=${campaign.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl bg-[#f7f9f7] px-3.5 py-3 transition hover:bg-[#f0f4f0] sm:min-w-40"
                >
                  <span className="flex items-center gap-2 text-xs font-medium text-[#69736b]"><Users size={15} /> Záujemcovia</span>
                  <span className="text-lg font-semibold">{campaign._count.leads}</span>
                </Link>
              </div>

              <div className="mt-3 flex items-center justify-end gap-1 sm:mt-2">
                <Link
                  href={`/admin/kampane/${campaign.id}`}
                  className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[#4e5c52] hover:bg-[#f2f6f3] sm:hidden"
                >
                  <Pencil size={14} /> Upraviť
                </Link>
                <CampaignDeleteButton
                  campaignName={campaign.name}
                  leadCount={campaign._count.leads}
                  deleteAction={deleteCampaign.bind(null, campaign.id)}
                />
              </div>
            </article>
          ))}

          {campaigns.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#dce2dc] px-5 py-12 text-center">
              <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-[#edf6ff] text-[var(--accent)]">
                <Megaphone size={20} />
              </div>
              <h3 className="mt-4 text-sm font-semibold">Zatiaľ tu nie je žiadna kampaň</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#7d877f]">Vytvorte prvú kampaň a získajte verejnú stránku pripravenú pre reklamu.</p>
              <Link href="/admin/kampane/nova" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-dark)] hover:underline">
                <Plus size={15} /> Vytvoriť prvú kampaň
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mt-14">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#6d796f]">
              <ChartNoAxesColumnIncreasing size={17} aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[.14em]">Výkon</p>
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-[-.02em]">Záujemcovia podľa kampane</h2>
          </div>
          <p className="text-xs text-[#8a938c]">
            {topCampaign ? `Najúspešnejšia: ${topCampaign.name}` : "Porovnanie sa zobrazí po vytvorení kampane"}
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-[#e4e8e3] bg-white px-4 sm:px-5">
          {campaignsByPerformance.map((campaign) => {
            const share = leadCount > 0 ? Math.round((campaign._count.leads / leadCount) * 100) : 0;
            return (
              <div key={campaign.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 border-b border-[#edf0ed] py-4 last:border-b-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className={`size-1.5 shrink-0 rounded-full ${campaign.isActive ? "bg-[#7da33e]" : "bg-[#b9bfba]"}`} />
                    <Link href={`/admin/kampane/${campaign.id}`} className="truncate text-sm font-semibold hover:underline">{campaign.name}</Link>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edf0ed]" aria-label={`${campaign.name}: ${share} % všetkých záujemcov`}>
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${share}%` }} />
                  </div>
                </div>
                <div className="min-w-12 text-right">
                  <p className="text-lg font-semibold">{campaign._count.leads}</p>
                  <p className="text-[.68rem] text-[#8a928c]">{share} %</p>
                </div>
              </div>
            );
          })}
          {campaignsByPerformance.length === 0 && <p className="py-10 text-center text-sm text-[#788179]">Po vytvorení kampane tu uvidíte jej výkon.</p>}
        </div>
      </section>

      <section className="mt-14">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a938c]">Kontakty</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-.02em]">Najnovší záujemcovia</h2>
          </div>
          <Link href="/admin/leady" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#5e695f] hover:text-[var(--ink)] sm:text-sm">
            Zobraziť všetkých <ChevronRight size={15} />
          </Link>
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#e4e8e3] bg-white px-4 sm:px-5">
          {recentLeads.map((lead) => (
            <Link key={lead.id} href={`/admin/leady/${lead.id}`} className="grid gap-1.5 border-b border-[#edf0ed] py-4 transition last:border-b-0 hover:pl-1 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
              <span className="font-semibold">{lead.name}</span>
              <span className="text-sm text-[#727c74]">{lead.campaign.name}</span>
              <span className="text-xs text-[#929a94]">{formatDate(lead.createdAt)}</span>
            </Link>
          ))}
          {recentLeads.length === 0 && <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#788179]"><Users size={16} /> Keď niekto odošle formulár, zobrazí sa tu.</div>}
        </div>
      </section>

      <CampaignGuide
        metaAdsConfigured={getMetaConnectionSummary().configured}
        metaPixelConfigured={metaPixelConfigured}
        emailConfigured={emailConfigured}
      />
    </>
  );
}
