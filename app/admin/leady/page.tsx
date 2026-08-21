import Link from "next/link";
import { Filter } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ kampan?: string }> }) {
  const { kampan } = await searchParams;
  const [campaigns, leads] = await Promise.all([
    prisma.campaign.findMany({ orderBy: { name: "asc" } }),
    prisma.lead.findMany({
      where: kampan ? { campaignId: kampan } : undefined,
      include: { campaign: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Kontakty z reklám</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Záujemcovia</h1>
        <p className="mt-2 text-sm text-[#737c75]">Všetky odoslané formuláre, automaticky priradené ku kampani.</p>
      </header>

      <form className="mt-9 flex flex-wrap items-center gap-3" method="get">
        <Filter size={15} className="text-[#7e8880]" />
        <label className="sr-only" htmlFor="campaign-filter">Filtrovať podľa kampane</label>
        <select id="campaign-filter" name="kampan" defaultValue={kampan ?? ""} className="border-0 border-b border-[#d6ddd7] bg-transparent py-2 pr-8 text-sm outline-none focus:border-[var(--ink)]">
          <option value="">Všetky kampane</option>
          {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
        </select>
        <button className="text-sm font-semibold text-[#566259] hover:text-[var(--ink)]" type="submit">Filtrovať</button>
        {kampan && <Link href="/admin/leady" className="text-sm text-[#8b938d] hover:text-[var(--ink)]">Zrušiť filter</Link>}
      </form>

      <div className="mt-7 overflow-x-auto">
        <table className="admin-table w-full border-collapse text-left text-sm">
          <thead className="text-xs uppercase tracking-[.08em] text-[#8a928c]">
            <tr className="border-b border-[var(--line)]"><th className="py-3 font-medium">Kontakt</th><th className="py-3 font-medium">Kampaň</th><th className="py-3 font-medium">Typ záujmu</th><th className="py-3 text-right font-medium">Dátum</th><th className="w-10" /></tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-[var(--line)] transition hover:bg-[#f5f7f4]">
                <td className="py-4 pr-4"><Link className="font-semibold hover:underline" href={`/admin/leady/${lead.id}`}>{lead.name}</Link><p className="mt-1 text-xs text-[#8a928c]">{lead.phone}</p></td>
                <td className="py-4 pr-4" data-label="Kampaň">{lead.campaign.name}</td>
                <td className="py-4 pr-4 text-[#667168]" data-label="Záujem">{lead.interestType}</td>
                <td className="py-4 text-right text-xs text-[#8a928c]" data-label="Dátum">{formatDate(lead.createdAt)}</td>
                <td className="py-4 pl-4 text-right"><Link href={`/admin/leady/${lead.id}`} aria-label={`Detail záujemcu ${lead.name}`}>→</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && <p className="py-14 text-center text-sm text-[#788179]">Pre zvolený filter nie sú žiadni záujemcovia.</p>}
      </div>
    </>
  );
}
