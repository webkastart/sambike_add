import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { deleteCampaign, toggleCampaign, updateCampaign } from "@/app/actions";
import { CampaignActions } from "@/components/campaign-actions";
import { CampaignForm } from "@/components/campaign-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) notFound();
  const updateAction = updateCampaign.bind(null, campaign.id);
  const toggleAction = toggleCampaign.bind(null, campaign.id);
  const removeAction = deleteCampaign.bind(null, campaign.id);

  return (
    <>
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-[#707a72] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Späť na kampane</Link>
      <header className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Úprava kampane</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">{campaign.name}</h1>
        </div>
        <Link href={`/kampan/${campaign.slug}`} target="_blank" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[#59655c] hover:text-[var(--ink)]">Otvoriť landing page <ArrowUpRight size={15} /></Link>
      </header>
      {query.error && <p className="mt-7 text-sm font-medium text-[#a1433e]">{query.error}</p>}
      {query.saved && <p className="mt-7 text-sm font-medium text-[#4e6a37]">Zmeny boli uložené.</p>}
      <CampaignForm campaign={campaign} action={updateAction} submitLabel="Uložiť zmeny" />
      <CampaignActions isActive={campaign.isActive} toggleAction={toggleAction} deleteAction={removeAction} />
    </>
  );
}
