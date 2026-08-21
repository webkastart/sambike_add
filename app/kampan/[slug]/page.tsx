import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, Check, Mail, MapPin, Phone } from "lucide-react";
import { LeadForm } from "@/components/lead-form";
import { Logo } from "@/components/logo";
import { prisma } from "@/lib/prisma";
import { telHref } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { slug } });
  if (!campaign) return {};
  return {
    title: campaign.headline,
    description: campaign.description,
    openGraph: { title: campaign.headline, description: campaign.description, images: ["/og.png"] },
  };
}

export default async function CampaignLandingPage({ params }: Props) {
  const { slug } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { slug } });
  if (!campaign?.isActive) notFound();
  const primaryHref = campaign.formEnabled ? "#mam-zaujem" : `mailto:${campaign.email}`;

  return (
    <main className="min-h-screen bg-[#f8faf6]">
      <section className="relative min-h-[92svh] overflow-hidden bg-[#142219] text-white">
        {/* Admin môže v MVP použiť ľubovoľnú verejnú URL, preto obrázok neviažeme na host allowlist. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={campaign.imageUrl} alt={campaign.headline} className="absolute inset-0 size-full object-cover opacity-55" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#111b15]/95 via-[#111b15]/60 to-transparent" />
        <div className="relative mx-auto flex min-h-[92svh] max-w-7xl flex-col px-5 py-7 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between">
            <Logo href={`/kampan/${campaign.slug}`} light />
            <a href={telHref(campaign.phone)} className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 transition hover:text-white"><Phone size={15} /> <span className="hidden sm:inline">{campaign.phone}</span><span className="sm:hidden">Zavolať</span></a>
          </header>

          <div className="my-auto max-w-3xl py-20">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">{campaign.offerType}</p>
            <h1 className="mt-6 text-[clamp(3rem,8vw,7.5rem)] font-semibold leading-[.9] tracking-[-.065em]">{campaign.headline}</h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/78 sm:text-xl">{campaign.description}</p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Link href={primaryHref} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[var(--accent)] px-6 py-3 font-bold text-[#17231b] transition hover:bg-[#e4ff76]">{campaign.ctaText}</Link>
              <a href={telHref(campaign.phone)} className="inline-flex min-h-12 items-center gap-2 border-b border-white/45 px-1 font-semibold text-white transition hover:border-white"><Phone size={17} /> Zavolať teraz</a>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-6 border-t border-white/20 pt-6">
            <div><p className="text-xs uppercase tracking-[.14em] text-white/55">Cena</p><p className="mt-1 text-2xl font-semibold text-[var(--accent)] sm:text-3xl">{campaign.priceText}</p></div>
            {campaign.formEnabled && <a href="#mam-zaujem" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">Zistiť viac <ArrowDown size={15} /></a>}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:px-12 lg:py-28">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#71805c]">Jednoducho a bez starostí</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Viac času na jazdu.<br />Menej riešenia.</h2>
        </div>
        <div className="grid gap-7 sm:grid-cols-3">
          {["Bicykel pripravíme presne na vás", "Poradíme trasu podľa skúseností", "Rýchla rezervácia bez platby vopred"].map((item) => (
            <div key={item} className="border-t border-[#dce3dc] pt-5"><Check size={18} className="text-[#738d45]" /><p className="mt-4 leading-relaxed text-[#4f5b52]">{item}</p></div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28">
        <div className="grid gap-6 border-t border-[#dce3dc] pt-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#71805c]">Od dielne až na trail</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-.04em] sm:text-5xl">
              Bicykel, ktorý je pripravený na váš deň.
            </h2>
          </div>
          <p className="max-w-lg leading-relaxed text-[#657067] lg:col-span-5">
            Každý bicykel pred jazdou skontrolujeme, nastavíme a odporučíme trasu, na ktorej si ho naozaj užijete.
          </p>
        </div>

        <div className="mt-12 grid gap-x-6 gap-y-10 lg:grid-cols-12">
          <figure className="lg:col-span-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1535369643553-a33e0d1ac81d?auto=format&fit=crop&w=1800&q=82"
              alt="Cyklista na horskom bicykli prechádza lesným trailom"
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full object-cover"
            />
            <figcaption className="mt-3 text-xs text-[#7e8880]">Trasy, na ktoré sa budete chcieť vrátiť.</figcaption>
          </figure>

          <figure className="lg:col-span-5 lg:mt-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1675798226758-a2e241b376fb?auto=format&fit=crop&w=1400&q=82"
              alt="Mechanik precízne pracuje na bicykli v servise"
              loading="lazy"
              decoding="async"
              className="aspect-[5/4] w-full object-cover"
            />
            <figcaption className="mt-3 text-xs text-[#7e8880]">Servis a kontrola pred každou jazdou.</figcaption>
          </figure>

          <figure className="lg:col-span-4 lg:mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1760310936486-4dd450aab2a8?auto=format&fit=crop&w=1200&q=82"
              alt="Stena s náradím v profesionálnej cyklistickej dielni"
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-full object-cover"
            />
            <figcaption className="mt-3 text-xs text-[#7e8880]">Poctivé remeslo bez skratiek.</figcaption>
          </figure>

          <figure className="lg:col-span-8 lg:mt-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1582743545823-75cfc1a732fb?auto=format&fit=crop&w=1800&q=82"
              alt="Detail kolesa a pohonu elektrického bicykla"
              loading="lazy"
              decoding="async"
              className="aspect-[16/10] w-full object-cover"
            />
            <figcaption className="mt-3 flex items-center justify-between gap-4 text-xs text-[#7e8880]">
              <span>Technika, na ktorú sa môžete spoľahnúť.</span>
              <a href="https://unsplash.com" target="_blank" rel="noreferrer" className="shrink-0 hover:text-[var(--ink)]">Fotografie: Unsplash ↗</a>
            </figcaption>
          </figure>
        </div>
      </section>

      {campaign.formEnabled && (
        <section id="mam-zaujem" className="scroll-mt-8 bg-[#eef2ec]">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.75fr_1.25fr] lg:px-12 lg:py-24">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#71805c]">Nezáväzný záujem</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-.045em]">Poďme to naplánovať</h2>
              <p className="mt-5 max-w-sm leading-relaxed text-[#657067]">Nechajte nám kontakt. Ozveme sa, overíme dostupnosť a dohodneme detaily.</p>
              <div className="mt-9 space-y-3 text-sm">
                <a href={telHref(campaign.phone)} className="flex items-center gap-3 hover:underline"><Phone size={16} />{campaign.phone}</a>
                <a href={`mailto:${campaign.email}`} className="flex items-center gap-3 hover:underline"><Mail size={16} />{campaign.email}</a>
                <p className="flex items-center gap-3 text-[#657067]"><MapPin size={16} />Liptov, Slovensko</p>
              </div>
            </div>
            <LeadForm campaignId={campaign.id} offerType={campaign.offerType} />
          </div>
        </section>
      )}

      <footer className="bg-[#142219] px-5 py-7 text-white sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo href={`/kampan/${campaign.slug}`} light />
          <p className="text-xs text-white/50">© {new Date().getFullYear()} SAMBIKE · Demo landing page</p>
        </div>
      </footer>
    </main>
  );
}
