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
      <Link href="/admin/leady" className="inline-flex items-center gap-2 text-sm text-[#707a72] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Späť na záujemcov</Link>
      <header className="mt-7">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Detail záujemcu</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">{lead.name}</h1>
        <p className="mt-2 text-sm text-[#818a83]">Prijaté {formatDate(lead.createdAt)}</p>
      </header>

      <section className="mt-11 grid gap-x-14 gap-y-9 border-y border-[var(--line)] py-9 sm:grid-cols-2">
        <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#8a928c]">Telefón</p><a className="mt-2 inline-flex items-center gap-2 text-lg font-medium hover:underline" href={telHref(lead.phone)}><Phone size={17} />{lead.phone}</a></div>
        <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#8a928c]">E-mail</p>{lead.email ? <a className="mt-2 inline-flex items-center gap-2 text-lg font-medium hover:underline" href={`mailto:${lead.email}`}><Mail size={17} />{lead.email}</a> : <p className="mt-2 text-[#8b938d]">Neuvedený</p>}</div>
        <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#8a928c]">Kampaň</p><Link className="mt-2 inline-flex items-center gap-2 font-medium hover:underline" href={`/admin/kampane/${lead.campaign.id}`}>{lead.campaign.name}<ExternalLink size={14} /></Link></div>
        <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#8a928c]">Typ záujmu</p><p className="mt-2 font-medium">{lead.interestType}</p></div>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="text-sm font-semibold uppercase tracking-[.12em] text-[#8a928c]">Poznámka</h2>
        <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed text-[#374139]">{lead.note || "Bez poznámky."}</p>
        <p className="mt-10 text-xs text-[#8b938d]">Súhlas so spracovaním údajov: {lead.consent ? "áno" : "nie"}</p>
      </section>
    </>
  );
}
