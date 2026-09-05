import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createCampaign } from "@/app/actions";
import { CampaignForm } from "@/components/campaign-form";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  return (
    <>
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-[#707a72] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Späť na kampane</Link>
      <header className="mt-7">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Nová kampaň</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Vytvoriť kampaň</h1>
        <p className="mt-2 text-sm text-[#737c75]">Po uložení vznikne samostatná verejná stránka kampane.</p>
      </header>
      {query.error && (
        <p className="mt-7 border-l-2 border-[#a1433e] bg-[#fff7f6] px-4 py-3 text-sm font-medium text-[#8f332f]" role="alert">
          {query.error}
        </p>
      )}
      <CampaignForm action={createCampaign} submitLabel="Vytvoriť kampaň" />
    </>
  );
}
