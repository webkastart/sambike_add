import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { applyExperimentVariant, changeCampaignStatus, duplicateCampaign, publishCampaign, restoreCampaignVersion, saveCampaignExperiment, saveCampaignSections, scheduleCampaign, updateCampaignSettings } from "@/app/actions";
import { CampaignActions } from "@/components/campaign-actions";
import { CampaignContentEditor } from "@/components/campaign-content-editor";
import { CampaignSettingsForm } from "@/components/campaign-settings-form";
import { MetaAdSection } from "@/components/meta-ad-section";
import { prisma } from "@/lib/prisma";
import { getMetaConnectionSummary } from "@/lib/meta-ads";
import { createMetaAd, deleteMetaAd, setMetaAdStatus, syncMetaAd, updateMetaAdBudget } from "@/app/meta-actions";
import { resolvePeriod } from "@/lib/date-range";
import { attributionSource } from "@/lib/crm";
import { formatDate } from "@/lib/format";
import { safeRate } from "@/lib/performance";
import { campaignReadiness, changedSnapshotFields, createCampaignPreviewToken, publicationSnapshot, variantConversion } from "@/lib/campaign-workflow";
import { resolveCampaignSections } from "@/lib/campaign-sections";
import { getCampaignMediaLibrary } from "@/lib/campaign-media-library";
import { CampaignMediaUrlField } from "@/components/campaign-media-url-field";

export const dynamic = "force-dynamic";

function bratislavaInput(value: Date | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value).replace(" ", "T");
}

export default async function EditCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    metaError?: string;
    metaCreated?: string;
    metaDeleted?: string;
    metaStatus?: string;
    metaSynced?: string;
    metaBudget?: string;
    published?: string;
    scheduled?: string;
    restored?: string;
    duplicated?: string;
    experimentSaved?: string;
    variantApplied?: string;
    obdobie?: string;
    od?: string;
    do?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      metaAd: true,
      galleryItems: { orderBy: { sortOrder: "asc" } },
      sections: { orderBy: { position: "asc" } },
      _count: { select: { leads: true } },
      publications: { orderBy: { version: "desc" }, take: 10 },
      auditEntries: { orderBy: { createdAt: "desc" }, take: 20 },
      experiment: true,
    },
  });
  if (!campaign) notFound();
  const mediaLibrary = await getCampaignMediaLibrary(id);
  const period = resolvePeriod(query.obdobie, query.od, query.do);
  const range = { gte: period.start, lt: period.end };
  const [eventGroups, periodLeadCount, revenue, recentLeads, sources, metaPeriod, variantGroups] = await Promise.all([
    prisma.campaignEvent.groupBy({ by: ["type"], where: { campaignId: id, occurredAt: range }, _count: { _all: true } }),
    prisma.lead.count({ where: { campaignId: id, createdAt: range } }),
    prisma.lead.aggregate({ where: { campaignId: id, status: "COMPLETED", completedAt: range }, _sum: { completedValueCents: true }, _count: { _all: true } }),
    prisma.lead.findMany({ where: { campaignId: id }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.lead.groupBy({ by: ["utmSource"], where: { campaignId: id, createdAt: range }, _count: { _all: true }, orderBy: { _count: { utmSource: "desc" } }, take: 6 }),
    campaign.metaAd ? prisma.metaDailyMetric.aggregate({ where: { metaAdCampaignId: campaign.metaAd.id, date: range }, _sum: { spendCents: true, impressions: true, clicks: true, metaLeads: true }, _count: { _all: true } }) : null,
    prisma.campaignEvent.groupBy({ by: ["variant", "type"], where: { campaignId: id, occurredAt: range, variant: { not: null } }, _count: { _all: true } }),
  ]);
  const event = (type: string) => eventGroups.find((row) => row.type === type)?._count._all ?? 0;
  const leadCount = periodLeadCount;
  const completedCount = revenue._count._all;
  const metaStale = campaign.metaAd?.lastSyncedAt ? campaign.metaAd.lastSyncedAt < new Date(period.end.getTime() - 36 * 60 * 60 * 1000) : Boolean(campaign.metaAd);
  const saveSectionsAction = saveCampaignSections.bind(null, campaign.id);
  const updateSettingsAction = updateCampaignSettings.bind(null, campaign.id);
  const publishAction = publishCampaign.bind(null, campaign.id);
  const readyAction = changeCampaignStatus.bind(null, campaign.id, "READY");
  const pauseCampaignAction = changeCampaignStatus.bind(null, campaign.id, "PAUSED");
  const archiveAction = changeCampaignStatus.bind(null, campaign.id, "ARCHIVED");
  const restoreDraftAction = changeCampaignStatus.bind(null, campaign.id, "DRAFT");
  const duplicateAction = duplicateCampaign.bind(null, campaign.id);
  const scheduleAction = scheduleCampaign.bind(null, campaign.id);
  const experimentAction = saveCampaignExperiment.bind(null, campaign.id);
  const applyVariantAction = applyExperimentVariant.bind(null, campaign.id);
  const createMetaAction = createMetaAd.bind(null, campaign.id);
  const startMetaAction = setMetaAdStatus.bind(null, campaign.id, "ACTIVE");
  const pauseMetaAction = setMetaAdStatus.bind(null, campaign.id, "PAUSED");
  const syncMetaAction = syncMetaAd.bind(null, campaign.id);
  const deleteMetaAction = deleteMetaAd.bind(null, campaign.id);
  const budgetMetaAction = updateMetaAdBudget.bind(null, campaign.id);
  const metaMessage = query.metaBudget
    ? "Denný rozpočet bol bezpečne aktualizovaný a zaevidovaný v audite."
    : query.metaCreated
    ? "Reklama bola vytvorená ako pozastavená. Skontrolujte ju a až potom ju spustite."
    : query.metaDeleted
      ? "Meta reklama bola odstránená."
      : query.metaSynced
        ? "Stav a výsledky boli aktualizované."
        : query.metaStatus === "active"
          ? "Reklama bola odoslaná na spustenie. Meta ju ešte môže kontrolovať."
          : query.metaStatus === "paused"
            ? "Reklama bola pozastavená."
            : undefined;
  const readiness = campaignReadiness(campaign, { appUrl: process.env.APP_URL, requireProductionUrl: process.env.NODE_ENV === "production" });
  const previewHref = `/kampan/${campaign.slug}?preview=${encodeURIComponent(createCampaignPreviewToken(campaign.id))}&variant=A`;
  const variantMetric = (variant: "A" | "B") => variantConversion(
    variantGroups.find((row) => row.variant === variant && row.type === "PAGE_VIEW")?._count._all ?? 0,
    variantGroups.find((row) => row.variant === variant && row.type === "LEAD_CREATED")?._count._all ?? 0,
  );
  const variantA = variantMetric("A");
  const variantB = variantMetric("B");
  const currentSnapshot = publicationSnapshot(campaign);
  const editableSections = resolveCampaignSections(campaign);

  return (
    <>
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-[#707a72] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Späť na kampane</Link>
      <header className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Úprava kampane</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">{campaign.name}</h1>
        </div>
        <Link href={campaign.status === "PUBLISHED" ? `/kampan/${campaign.slug}` : previewHref} target="_blank" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[#59655c] hover:text-[var(--ink)]">{campaign.status === "PUBLISHED" ? "Otvoriť verejnú stránku" : "Otvoriť bezpečný náhľad"} <ArrowUpRight size={15} /></Link>
      </header>
      {query.error && (
        <p className="mt-7 border-l-2 border-[#a1433e] bg-[#fff7f6] px-4 py-3 text-sm font-medium text-[#8f332f]" role="alert">
          {query.error}
        </p>
      )}
      {query.saved && <p className="mt-7 text-sm font-medium text-[#4e6a37]">{query.saved === "content" ? "Obsah stránky bol uložený." : query.saved === "settings" ? "Nastavenia kampane boli uložené." : "Zmeny boli uložené."}</p>}
      {query.published && <p className="mt-7 text-sm font-medium text-[#4e6a37]">Landing page bola publikovaná a vznikol nemenný snapshot.</p>}
      {query.scheduled && <p className="mt-7 text-sm font-medium text-[#4e6a37]">Plán bol uložený v časovom pásme Europe/Bratislava.</p>}
      <CampaignActions status={campaign.status} previewHref={previewHref} publishAction={publishAction} readyAction={readyAction} pauseAction={pauseCampaignAction} archiveAction={archiveAction} restoreDraftAction={restoreDraftAction} duplicateAction={duplicateAction} />

      <section className="mt-10" aria-labelledby="readiness-title"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a938c]">Kontrola pred publikovaním</p><h2 id="readiness-title" className="mt-1 text-xl font-semibold">{readiness.ready ? "Kampaň je pripravená" : "Doplňte povinné údaje"}</h2></div>{readiness.ready && (campaign.status === "READY" || campaign.status === "PAUSED") && <form action={publishAction}><button className="rounded-[3px] bg-[var(--accent-dark)] px-5 py-2.5 text-sm font-semibold text-white">Publikovať landing page</button></form>}</div><ul className="mt-5 grid gap-x-8 gap-y-3 border-y border-[var(--line)] py-5 sm:grid-cols-2">{readiness.items.map((item) => <li key={item.key} className="flex items-start gap-3 text-sm"><span aria-hidden="true" className={item.ready ? "text-[#4e6a37]" : item.level === "required" ? "text-[#a1433e]" : "text-[#9a6b25]"}>{item.ready ? "✓" : item.level === "required" ? "×" : "!"}</span><span><strong className="font-medium">{item.label}</strong><span className="ml-2 text-xs text-[#8a928c]">{item.level === "required" ? "povinné" : "odporúčané"}</span>{item.detail && <span className="mt-1 block break-all text-xs text-[#8a928c]">{item.detail}</span>}</span></li>)}</ul></section>
      <section className="mt-10 border-y border-[var(--line)] py-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a938c]">Posledných 30 dní</p><h2 className="mt-1 text-xl font-semibold">Funnel a obchodný výsledok</h2></div><Link href={`/admin/leady?kampan=${campaign.id}`} className="text-sm font-semibold text-[var(--accent-dark)]">Otvoriť leady kampane →</Link></div>
        <div className="mt-6 grid grid-cols-2 gap-y-6 sm:grid-cols-4 lg:grid-cols-7">{[
          ["Zobrazenia / udalosti", event("PAGE_VIEW")], ["CTA", event("CTA_CLICK")], ["Formuláre", event("FORM_START")], ["Leady", leadCount], ["Dokončené", completedCount],
          ["Konverzia", safeRate(leadCount, event("PAGE_VIEW")) == null ? "—" : `${(safeRate(leadCount, event("PAGE_VIEW"))! * 100).toFixed(1)} %`],
          ["Tržba", completedCount ? `${((revenue._sum.completedValueCents ?? 0) / 100).toLocaleString("sk-SK", { minimumFractionDigits: 2 })} €` : "—"],
        ].map(([label, value]) => <div key={label}><p className="text-xl font-semibold">{value}</p><p className="mt-1 text-xs text-[#737c75]">{label}</p></div>)}</div>
        <div className="mt-8 grid gap-8 lg:grid-cols-3"><div><h3 className="text-sm font-semibold">Zdroje leadov</h3><ul className="mt-3 space-y-2 text-sm">{sources.map((source) => <li key={source.utmSource ?? "direct"} className="flex justify-between"><span>{source.utmSource || "Direct / neznámy"}</span><strong>{source._count._all}</strong></li>)}{sources.length === 0 && <li className="text-[#788179]">Bez dát</li>}</ul></div><div><h3 className="text-sm font-semibold">Posledné leady</h3><ul className="mt-3 space-y-2 text-sm">{recentLeads.map((lead) => <li key={lead.id}><Link className="flex justify-between gap-4 hover:underline" href={`/admin/leady/${lead.id}`}><span>{lead.name} · {attributionSource(lead)}</span><span className="text-xs text-[#8a928c]">{formatDate(lead.createdAt)}</span></Link></li>)}{recentLeads.length === 0 && <li className="text-[#788179]">Bez leadov</li>}</ul></div><div><h3 className="text-sm font-semibold">Meta výsledky</h3>{metaPeriod && metaPeriod._count._all > 0 ? <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-[#8a928c]">Spend</dt><dd>{((metaPeriod._sum.spendCents ?? 0) / 100).toFixed(2)} €</dd></div><div><dt className="text-xs text-[#8a928c]">Impressions</dt><dd>{metaPeriod._sum.impressions ?? 0}</dd></div><div><dt className="text-xs text-[#8a928c]">Kliknutia</dt><dd>{metaPeriod._sum.clicks ?? 0}</dd></div><div><dt className="text-xs text-[#8a928c]">Meta leady</dt><dd>{metaPeriod._sum.metaLeads ?? 0}</dd></div></dl> : <p className="mt-3 text-sm text-[#788179]">— Denné Meta dáta pre obdobie nie sú k dispozícii.</p>}{campaign.metaAd && <p className={`mt-4 text-xs ${metaStale ? "font-semibold text-[#9a6b25]" : "text-[#737c75]"}`}>{campaign.metaAd.lastSyncedAt ? `Posledná synchronizácia ${formatDate(campaign.metaAd.lastSyncedAt)}${metaStale ? " · dáta môžu byť zastarané" : ""}` : "Meta dáta ešte neboli synchronizované."}</p>}</div></div>
      </section>
      {campaign.status !== "ARCHIVED" ? <><CampaignContentEditor sections={editableSections} galleryItems={campaign.galleryItems} action={saveSectionsAction} previewHref={previewHref} currentCampaignId={campaign.id} mediaLibrary={mediaLibrary} /><CampaignSettingsForm campaign={campaign} action={updateSettingsAction} mediaLibrary={mediaLibrary} /></> : <p className="mt-10 border-y border-[var(--line)] py-6 text-sm text-[#737c75]">Archivovaná kampaň je iba na čítanie. Leady, metriky, audit a publikované verzie zostávajú dostupné.</p>}

      <section className="mt-16 border-t border-[var(--line)] pt-10" aria-labelledby="schedule-title"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a938c]">Europe/Bratislava</p><h2 id="schedule-title" className="mt-1 text-xl font-semibold">Plánované publikovanie a ukončenie</h2><form action={scheduleAction} className="mt-6 grid max-w-2xl gap-6 sm:grid-cols-2"><label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Publikovať</span><input className="admin-field" type="datetime-local" name="publishAt" defaultValue={bratislavaInput(campaign.publishAt)} /></label><label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Ukončiť / pozastaviť</span><input className="admin-field" type="datetime-local" name="unpublishAt" defaultValue={bratislavaInput(campaign.unpublishAt)} /></label><div className="sm:col-span-2"><button className="text-sm font-semibold text-[var(--accent-dark)]" type="submit">Uložiť plán →</button>{campaign.scheduleError && <p className="mt-3 text-sm text-[#a1433e]">Posledná chyba: {campaign.scheduleError}</p>}</div></form></section>

      <section className="mt-16 border-t border-[var(--line)] pt-10" aria-labelledby="experiment-title"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a938c]">A/B test</p><h2 id="experiment-title" className="mt-1 text-xl font-semibold">Variant hero obsahu</h2><p className="mt-2 max-w-2xl text-sm text-[#737c75]">Bez marketingového súhlasu je priradenie iba relačná cookie bez trvalého identifikátora. Pri súhlase zostáva variant stabilný. Malé vzorky sú iba orientačné.</p><div className="mt-6 grid max-w-xl grid-cols-2 border-y border-[var(--line)] py-5 text-sm"><div><strong>Variant A</strong><p className="mt-2">{variantA.views} zobrazení · {variantA.leads} leadov</p><p>{variantA.conversion == null ? "—" : `${(variantA.conversion * 100).toFixed(1)} %`}{variantA.indicative ? " · orientačné" : ""}</p></div><div><strong>Variant B</strong><p className="mt-2">{variantB.views} zobrazení · {variantB.leads} leadov</p><p>{variantB.conversion == null ? "—" : `${(variantB.conversion * 100).toFixed(1)} %`}{variantB.indicative ? " · orientačné" : ""}</p></div></div>{campaign.experiment?.changedWhileRunning && <p className="mt-4 text-sm font-semibold text-[#9a6b25]">Experiment bol počas behu zmenený; výsledky interpretujte opatrne.</p>}<form action={experimentAction} className="mt-6 grid max-w-3xl gap-6 sm:grid-cols-2"><label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Stav</span><select className="admin-field" name="experimentStatus" defaultValue={campaign.experiment?.status ?? "DRAFT"}><option value="DRAFT">Koncept</option><option value="RUNNING">Beží</option><option value="PAUSED">Pozastavený</option><option value="COMPLETED">Ukončený</option></select></label><span /><label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Hero nadpis B</span><input className="admin-field" name="variantHeadline" defaultValue={campaign.experiment?.variantHeadline ?? ""} maxLength={160} /></label><label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">CTA B</span><input className="admin-field" name="variantCtaText" defaultValue={campaign.experiment?.variantCtaText ?? ""} maxLength={80} /></label><label className="sm:col-span-2"><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Krátky popis B</span><textarea className="admin-field" name="variantDescription" defaultValue={campaign.experiment?.variantDescription ?? ""} maxLength={800} /></label><div className="sm:col-span-2"><CampaignMediaUrlField label="Hero obrázok B · URL" name="variantImageUrl" defaultValue={campaign.experiment?.variantImageUrl ?? ""} mediaLibrary={mediaLibrary} currentCampaignId={campaign.id} mediaTypes={["IMAGE"]} labelClassName="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]" /></div><div className="sm:col-span-2 flex flex-wrap gap-5"><button className="text-sm font-semibold text-[var(--accent-dark)]" type="submit">Uložiť experiment →</button><Link className="text-sm font-semibold" target="_blank" href={`${previewHref.replace("variant=A", "variant=B")}`}>Náhľad B →</Link></div></form>{campaign.experiment?.status === "COMPLETED" && <form action={applyVariantAction} className="mt-5"><button className="text-sm font-semibold text-[#7a4c30]" type="submit">Použiť variant B ako nový koncept</button><p className="mt-1 text-xs text-[#8a928c]">Kampaň sa nepublikuje a reklama sa nespustí.</p></form>}</section>

      <section className="mt-16 border-t border-[var(--line)] pt-10" aria-labelledby="history-title"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a938c]">Nemenné snapshoty</p><h2 id="history-title" className="mt-1 text-xl font-semibold">História publikovaní</h2><ul className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">{campaign.publications.map((publication, index) => { const newer = index === 0 ? currentSnapshot : campaign.publications[index - 1].snapshot; const changed = changedSnapshotFields(publication.snapshot, newer); const restoreAction = restoreCampaignVersion.bind(null, campaign.id, publication.id); return <li key={publication.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Verzia {publication.version} · {formatDate(publication.publishedAt)}</p><p className="mt-1 text-xs text-[#8a928c]">{changed.length ? `Zmenené polia oproti novšiemu stavu: ${changed.join(", ")}` : "Bez zmien oproti aktuálnemu stavu"} · {publication.actor}</p></div><form action={restoreAction}><button className="text-sm font-semibold text-[#536057]" type="submit">Obnoviť do konceptu</button></form></li>; })}{campaign.publications.length === 0 && <li className="py-5 text-sm text-[#737c75]">Kampaň ešte nebola publikovaná.</li>}</ul></section>
      <MetaAdSection
        campaign={campaign}
        ad={campaign.metaAd}
        leadCount={campaign._count.leads}
        connection={getMetaConnectionSummary()}
        createAction={createMetaAction}
        startAction={startMetaAction}
        pauseAction={pauseMetaAction}
        syncAction={syncMetaAction}
        deleteAction={deleteMetaAction}
        budgetAction={budgetMetaAction}
        feedback={{ error: query.metaError, message: metaMessage }}
      />
    </>
  );
}
