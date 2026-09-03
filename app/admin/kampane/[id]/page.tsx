import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { deleteCampaign, toggleCampaign, updateCampaign } from "@/app/actions";
import { CampaignActions } from "@/components/campaign-actions";
import { CampaignForm } from "@/components/campaign-form";
import { MetaAdSection } from "@/components/meta-ad-section";
import { prisma } from "@/lib/prisma";
import { getMetaConnectionSummary } from "@/lib/meta-ads";
import { createMetaAd, deleteMetaAd, setMetaAdStatus, syncMetaAd } from "@/app/meta-actions";

export const dynamic = "force-dynamic";

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
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      metaAd: true,
      galleryItems: { orderBy: { sortOrder: "asc" } },
      _count: { select: { leads: true } },
    },
  });
  if (!campaign) notFound();
  const updateAction = updateCampaign.bind(null, campaign.id);
  const toggleAction = toggleCampaign.bind(null, campaign.id);
  const removeAction = deleteCampaign.bind(null, campaign.id);
  const createMetaAction = createMetaAd.bind(null, campaign.id);
  const startMetaAction = setMetaAdStatus.bind(null, campaign.id, "ACTIVE");
  const pauseMetaAction = setMetaAdStatus.bind(null, campaign.id, "PAUSED");
  const syncMetaAction = syncMetaAd.bind(null, campaign.id);
  const deleteMetaAction = deleteMetaAd.bind(null, campaign.id);
  const metaMessage = query.metaCreated
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

  return (
    <>
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-[#707a72] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Späť na kampane</Link>
      <header className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Úprava kampane</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">{campaign.name}</h1>
        </div>
        <Link href={`/kampan/${campaign.slug}`} target="_blank" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[#59655c] hover:text-[var(--ink)]">Otvoriť stránku kampane <ArrowUpRight size={15} /></Link>
      </header>
      {query.error && <p className="mt-7 text-sm font-medium text-[#a1433e]">{query.error}</p>}
      {query.saved && <p className="mt-7 text-sm font-medium text-[#4e6a37]">Zmeny boli uložené.</p>}
      <CampaignForm campaign={campaign} action={updateAction} submitLabel="Uložiť zmeny" />
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
        feedback={{ error: query.metaError, message: metaMessage }}
      />
      <CampaignActions isActive={campaign.isActive} toggleAction={toggleAction} deleteAction={removeAction} />
    </>
  );
}
