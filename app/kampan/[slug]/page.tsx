import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ExternalLink, Mail, MapPin, Phone, Play } from "lucide-react";
import { CampaignTracking } from "@/components/campaign-tracking";
import { LeadForm } from "@/components/lead-form";
import { MobileStickyCta } from "@/components/mobile-sticky-cta";
import { Logo } from "@/components/logo";
import { telHref } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import chainPhoto from "@/public/491416117_18327442552164899_6592296387915655104_n.jpg";
import serviceBikePhoto from "@/public/501092085_18330718675164899_5154079394919144617_n.jpg";
import wheelServicePhoto from "@/public/491371448_18327449569164899_1457638043555327763_n.jpg";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const facebookReelUrl = "https://www.facebook.com/reel/1362919532718299";
const facebookEmbedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(facebookReelUrl)}&show_text=false&width=500`;

const benefits = [
  "Bicykel pripravíme presne na vás",
  "Poradíme trasu podľa skúseností",
  "Rýchla rezervácia bez platby vopred",
];

const servicePhotos = [
  { src: serviceBikePhoto, alt: "Horský bicykel pripravený na servisnom stojane", caption: "Kontrola pred každou jazdou." },
  { src: chainPhoto, alt: "Porovnanie znečistenej a vyčistenej bicyklovej reťaze", caption: "Čistý pohon a pozornosť k detailu." },
  { src: wheelServicePhoto, alt: "Servis náboja bicyklového kolesa v dielni", caption: "Nastavenie, na ktoré sa môžete spoľahnúť." },
];

const faq = [
  { question: "Musím platiť vopred?", answer: "Nie. Odošlete nezáväznú požiadavku a detaily si potvrdíme spolu." },
  { question: "Ako si overím dostupnosť bicykla?", answer: "Vyplňte krátky formulár alebo nám zavolajte. Ozveme sa s potvrdením dostupnosti." },
  { question: "Akú veľkosť bicykla potrebujem?", answer: "Do poznámky môžete uviesť svoju výšku. Bicykel pred jazdou nastavíme na jazdca." },
  { question: "Kde bicykel prevezmem?", answer: "Miesto prevzatia v Slovenskom raji si potvrdíme pri dohodnutí detailov." },
  { question: "Čo ak bude zlé počasie?", answer: "Ozvite sa nám telefonicky. Ďalší postup dohodneme individuálne podľa vášho termínu." },
  { question: "Môžeme rezervovať viac bicyklov naraz?", answer: "Áno. Počet bicyklov uveďte do poznámky a pri potvrdení overíme ich dostupnosť." },
];

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
  const pixelId = /^\d+$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "")
    ? process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()
    : undefined;
  const isRemoteHero = /^https?:\/\//.test(campaign.imageUrl);

  return (
    <main className="campaign-page min-h-screen bg-[#f8faf6]">
      <CampaignTracking campaignSlug={campaign.slug} pixelId={pixelId} />

      <section data-campaign-hero className="relative min-h-[88svh] overflow-hidden bg-[#142219] text-white">
        <Image src={campaign.imageUrl} alt="" fill priority unoptimized={isRemoteHero} sizes="100vw" className="object-cover opacity-55" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#101a14]/95 via-[#101a14]/70 to-[#101a14]/20" />
        <div className="relative mx-auto flex min-h-[88svh] max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between">
            <Logo href={`/kampan/${campaign.slug}`} light />
            <a href={telHref(campaign.phone)} data-track="phone" className="inline-flex items-center gap-2 text-sm font-semibold text-white/85 transition hover:text-white">
              <Phone size={15} /><span className="hidden sm:inline">{campaign.phone}</span><span className="sm:hidden">Zavolať</span>
            </a>
          </header>

          <div className="my-auto max-w-3xl py-16 sm:py-20">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">{campaign.offerType}</p>
            <h1 className="mt-5 max-w-[12ch] text-[clamp(3rem,7.5vw,7rem)] font-semibold leading-[.9] tracking-[-.065em]">{campaign.headline}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/80 sm:text-xl">{campaign.description}</p>
            <p className="mt-5 text-2xl font-semibold text-[var(--accent)] sm:text-3xl">{campaign.priceText}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <a href={primaryHref} data-track="cta" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3 font-bold text-[#17231b] transition hover:bg-[#e4ff76]">
                {campaign.ctaText} <ArrowRight size={17} />
              </a>
              <a href={telHref(campaign.phone)} data-track="phone" className="inline-flex min-h-11 items-center gap-2 border-b border-white/45 px-1 font-semibold text-white transition hover:border-white">
                <Phone size={17} /> Zavolať
              </a>
            </div>
            {campaign.formEnabled && <p className="mt-4 text-xs text-white/65">Bez platby vopred <span aria-hidden="true">•</span> Ozveme sa s potvrdením</p>}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-9 px-5 py-14 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-end lg:px-12 lg:py-18">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#71805c]">Jednoducho a bez starostí</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Viac času na jazdu.<br />Menej riešenia.</h2>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3" aria-label="Výhody SAMBIKE">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3 text-sm leading-relaxed text-[#4f5b52] sm:block">
              <Check size={18} className="mt-0.5 shrink-0 text-[#6f8b3e] sm:mb-3 sm:mt-0" />{benefit}
            </li>
          ))}
        </ul>
      </section>

      {campaign.formEnabled && (
        <section id="mam-zaujem" data-lead-form-section className="scroll-mt-6 bg-[#eef2ec]">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[.72fr_1.28fr] lg:gap-16 lg:px-12 lg:py-18">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#71805c]">Nezáväzná požiadavka</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-.045em]">Overíme dostupnosť</h2>
              <p className="mt-4 max-w-sm leading-relaxed text-[#657067]">Stačí meno a telefón. Ozveme sa, overíme dostupnosť a dohodneme detaily.</p>
              <div className="mt-7 space-y-3 text-sm">
                <a href={telHref(campaign.phone)} data-track="phone" className="flex items-center gap-3 hover:underline"><Phone size={16} />{campaign.phone}</a>
                <a href={`mailto:${campaign.email}`} className="flex items-center gap-3 hover:underline"><Mail size={16} />{campaign.email}</a>
                <p className="flex items-center gap-3 text-[#657067]"><MapPin size={16} />Slovenský raj, Slovensko</p>
              </div>
            </div>
            <LeadForm campaignId={campaign.id} campaignSlug={campaign.slug} offerType={campaign.offerType} />
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:px-12 lg:py-24">
        <div className="relative aspect-[4/3] overflow-hidden bg-[#e9ede7]">
          <Image src={campaign.imageUrl} alt={campaign.headline} fill unoptimized={isRemoteHero} sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#71805c]">Aktuálna ponuka</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-.045em] sm:text-5xl">{campaign.name}</h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#5e6961]">{campaign.description}</p>
          <div className="mt-7 flex items-baseline gap-3 border-t border-[#dce3dc] pt-5">
            <span className="text-xs font-bold uppercase tracking-[.14em] text-[#7d887f]">Cena / akcia</span>
            <strong className="text-xl text-[#26372a]">{campaign.priceText}</strong>
          </div>
          <a href={primaryHref} data-track="cta" className="mt-7 inline-flex items-center gap-2 font-semibold text-[#26372a] underline decoration-[#a6bb57] decoration-2 underline-offset-4">{campaign.ctaText} <ArrowRight size={16} /></a>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-12 lg:pb-24">
        <div className="border-t border-[#dce3dc] pt-12">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#71805c]">Príprava pred jazdou</p>
          <h2 className="mt-3 max-w-4xl text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Bicykel dostanete pripravený, nie iba požičaný.</h2>
          <p className="mt-4 text-sm text-[#657067]">Kontrola <span aria-hidden="true">•</span> čistý pohon <span aria-hidden="true">•</span> správny tlak <span aria-hidden="true">•</span> nastavenie na jazdca</p>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {servicePhotos.map((photo) => (
            <figure key={photo.src.src}>
              <div className="relative aspect-[4/3] overflow-hidden bg-[#e9ede7]">
                <Image src={photo.src} alt={photo.alt} fill placeholder="blur" sizes="(max-width: 640px) 100vw, 33vw" className="object-cover transition duration-700 hover:scale-[1.015]" />
              </div>
              <figcaption className="mt-2 text-xs text-[#7e8880]">{photo.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="bg-[#142219] text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_380px] lg:px-12 lg:py-24">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">Pozrite si nás v akcii</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-.045em] sm:text-6xl">Servis nie je len práca. Je to remeslo.</h2>
            <p className="mt-5 text-lg leading-relaxed text-white/68">Reálne bicykle, reálna dielňa a práca s dôrazom na každý detail.</p>
            <a href={facebookReelUrl} target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-2 border-b border-white/35 pb-1 text-sm font-semibold transition hover:border-white"><Play size={16} fill="currentColor" /> Pozrieť Reel na Facebooku <ExternalLink size={14} /></a>
          </div>
          <div className="mx-auto w-full max-w-[380px] overflow-hidden bg-black">
            <iframe src={facebookEmbedUrl} title="SAMBIKE video z Facebooku" width="500" height="750" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen className="aspect-[9/16] h-auto w-full" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[.7fr_1.3fr] lg:px-12 lg:py-24">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#71805c]">Praktické informácie</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-.045em]">Časté otázky</h2>
        </div>
        <div>
          {faq.map((item, index) => (
            <details key={item.question} className="group border-t border-[#dce3dc] py-1" open={index === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 font-semibold marker:content-none">{item.question}<span className="text-xl font-normal text-[#71805c] transition group-open:rotate-45" aria-hidden="true">+</span></summary>
              <p className="max-w-2xl pb-5 pr-10 leading-relaxed text-[#657067]">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section data-final-cta className="bg-[var(--accent)] px-5 py-14 sm:px-8 lg:px-12 lg:py-18">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-7 sm:flex-row sm:items-center">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#53632d]">Bez platby vopred</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Overte si dostupnosť.</h2></div>
          <div className="flex flex-wrap items-center gap-5">
            <a href={primaryHref} data-track="cta" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#17231b] px-6 py-3 font-semibold text-white">{campaign.ctaText} <ArrowRight size={17} /></a>
            <a href={telHref(campaign.phone)} data-track="phone" className="inline-flex items-center gap-2 font-semibold text-[#17231b]"><Phone size={17} /> Zavolať</a>
          </div>
        </div>
      </section>

      <footer className="bg-[#142219] px-5 py-7 text-white sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo href={`/kampan/${campaign.slug}`} light />
          <p className="text-xs text-white/50">© {new Date().getFullYear()} SAMBIKE</p>
        </div>
      </footer>

      <MobileStickyCta ctaText={campaign.ctaText} primaryHref={primaryHref} phone={campaign.phone} />
    </main>
  );
}
