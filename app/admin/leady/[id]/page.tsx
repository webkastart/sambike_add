import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Phone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate, telHref } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, include: { campaign: true } });
  if (!lead) notFound();

  return (
    <>
      <Link href="/admin/leady" className="inline-flex items-center gap-2 text-sm text-[#707a72] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Späť na zoznam záujemcov</Link>
      <header className="mt-7">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Detail záujemcu</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">{lead.name}</h1>
        <p className="mt-2 text-sm text-[#818a83]">Požiadavka prijatá {formatDate(lead.createdAt)}</p>
      </header>

      <section className="mt-11 grid gap-x-14 gap-y-9 border-y border-[var(--line)] py-9 sm:grid-cols-2">
        <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#8a928c]">Telefón</p><a className="mt-2 inline-flex items-center gap-2 text-lg font-medium hover:underline" href={telHref(lead.phone)}><Phone size={17} />{lead.phone}</a></div>
        <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#8a928c]">E-mail</p>{lead.email ? <a className="mt-2 inline-flex items-center gap-2 text-lg font-medium hover:underline" href={`mailto:${lead.email}`}><Mail size={17} />{lead.email}</a> : <p className="mt-2 text-[#8b938d]">Neuvedený</p>}</div>
        <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#8a928c]">Kampaň</p><Link className="mt-2 inline-flex items-center gap-2 font-medium hover:underline" href={`/admin/kampane/${lead.campaign.id}`}>{lead.campaign.name}<ExternalLink size={14} /></Link></div>
        <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#8a928c]">Ponuka</p><p className="mt-2 font-medium">{lead.interestType}</p></div>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="text-sm font-semibold uppercase tracking-[.12em] text-[#8a928c]">Poznámka</h2>
        <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed text-[#374139]">{lead.note || "Bez poznámky."}</p>
        <p className="mt-10 text-xs text-[#8b938d]">Súhlas so spracovaním osobných údajov: {lead.consent ? "áno" : "nie"}</p>
      </section>

      {(lead.utmSource || lead.utmMedium || lead.utmCampaign || lead.utmContent || lead.utmTerm || lead.landingPage || lead.referrer) && (
        <section className="mt-12 max-w-3xl border-t border-[var(--line)] pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-[.12em] text-[#8a928c]">Zdroj návštevy</h2>
          <dl className="mt-5 grid gap-x-10 gap-y-5 text-sm sm:grid-cols-2">
            {[
              ["UTM zdroj", lead.utmSource],
              ["UTM médium", lead.utmMedium],
              ["UTM kampaň", lead.utmCampaign],
              ["UTM obsah", lead.utmContent],
              ["UTM výraz", lead.utmTerm],
              ["Navštívená stránka", lead.landingPage],
              ["Predchádzajúca stránka", lead.referrer],
            ].filter((entry): entry is [string, string] => Boolean(entry[1])).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-[.1em] text-[#8a928c]">{label}</dt>
                <dd className="mt-1 break-all text-[#48534b]">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}
