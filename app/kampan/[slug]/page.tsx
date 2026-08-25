import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  AtSign,
  Clock3,
  ExternalLink,
  Link as LinkIcon,
  Mail,
  MapPin,
  Phone,
  Play,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { CampaignTracking } from "@/components/campaign-tracking";
import { LeadForm } from "@/components/lead-form";
import { MobileStickyCta } from "@/components/mobile-sticky-cta";
import { Logo } from "@/components/logo";
import { telHref } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import chainPhoto from "@/public/491416117_18327442552164899_6592296387915655104_n.jpg";
import serviceBikePhoto from "@/public/491417690_18327440080164899_7888323766038421627_n.jpg";
import serviceOfferPhoto from "@/public/515698946_24696728493263694_6196605855722669004_n.jpg";
import workshopHandsPhoto from "@/public/467733589_18310927900164899_8844470234338486002_n.jpg";
import wheelBuildPhoto from "@/public/541515840_18341290783164899_2136127841415059329_n.jpg";
import hubDetailPhoto from "@/public/544104536_18341290717164899_4785665621800122151_n.jpg";
import chainLinkElement from "@/public/illustrations/chain-link.png";
import chainElement from "@/public/illustrations/chain.png";
import chainLubeElement from "@/public/illustrations/chain-lube.png";
import cranksetElement from "@/public/illustrations/crankset.png";
import helmetElement from "@/public/illustrations/helmet.png";
import serviceToolsElement from "@/public/illustrations/service-tools.png";
import tireElement from "@/public/illustrations/tire.png";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const facebookReelUrl = "https://www.facebook.com/reel/1362919532718299";
const facebookEmbedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(facebookReelUrl)}&show_text=false&width=500`;
const facebookProfileUrl = "https://www.facebook.com/samo.chlebovec";
const instagramProfileUrl = "https://www.instagram.com/sambike_snv/";

const benefits = [
  { icon: Clock3, title: "Rýchla dohoda", text: "Termín a dostupnosť overíme čo najskôr." },
  { icon: Wrench, title: "Osobný prístup", text: "Všetky práce a podrobnosti si vopred odsúhlasíme." },
  { icon: ShieldCheck, title: "Bez záväzku", text: "Za odoslanie požiadavky nič neplatíte." },
];

const faq = [
  { question: "Musím platiť vopred?", answer: "Nie. Formulár je nezáväzný a platbu dohodneme až po potvrdení vašej požiadavky." },
  { question: "Kedy sa mi ozvete?", answer: "Ozveme sa čo najskôr na telefónne číslo, ktoré uvediete vo formulári." },
  { question: "Čo mám uviesť do poznámky?", answer: "Napíšte nám želaný termín, typ bicykla, počet bicyklov a všetko, čo by sme mali vedieť." },
  { question: "Kde vás nájdem?", answer: "Servis Sambike nájdete na adrese Letná 51 v Spišskej Novej Vsi." },
  { question: "Môžem si vybrať termín?", answer: "Áno. Uveďte ho do poznámky a pri potvrdení spolu overíme dostupnosť." },
  { question: "Servisujete aj e-biky?", answer: "Áno. V servise sa venujeme cestným, gravelovým, horským aj elektrickým bicyklom." },
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
  const heroImage = campaign.slug === "servis" ? serviceBikePhoto : campaign.imageUrl;
  const isRemoteHero = typeof heroImage === "string" && /^https?:\/\//.test(heroImage);
  const offerImage = campaign.slug === "servis" ? serviceOfferPhoto : campaign.offerImageUrl || campaign.imageUrl;
  const galleryImage1 = !campaign.galleryImage1Url || campaign.galleryImage1Url === "/501092085_18330718675164899_5154079394919144617_n.jpg"
    ? wheelBuildPhoto
    : campaign.galleryImage1Url;
  const galleryImage2 = campaign.galleryImage2Url || chainPhoto;
  const galleryImage3 = !campaign.galleryImage3Url || campaign.galleryImage3Url === "/491371448_18327449569164899_1457638043555327763_n.jpg"
    ? hubDetailPhoto
    : campaign.galleryImage3Url;
  const servicePhotos = [
    {
      src: galleryImage1,
      alt: "Zapletené koleso s oranžovým nábojom v dielni Sambike",
      caption: "Kolesá, ktoré sa točia ako majú.",
      layout: "sm:col-span-7",
    },
    {
      src: galleryImage2,
      alt: "Porovnanie znečistenej a vyčistenej bicyklovej reťaze",
      caption: "Pohon vyčistený do posledného článku.",
      position: campaign.galleryImage2Url ? "center" : "top",
      layout: "sm:col-span-5",
    },
    {
      src: galleryImage3,
      alt: "Oranžový náboj pripravený na montáž",
      caption: "Nové diely, poctivo osadené.",
      layout: "sm:col-span-5",
    },
    {
      src: workshopHandsPhoto,
      alt: "Mastné ruky po práci na bicykli v dielni",
      caption: "Poctivá robota občas zanechá stopu.",
      position: "center",
      layout: "sm:col-span-7",
    },
  ];

  return (
    <main className="campaign-page min-h-screen bg-white text-[var(--ink)]">
      <CampaignTracking campaignSlug={campaign.slug} pixelId={pixelId} />

      <section data-campaign-hero className="bg-white">
        <header className="mx-auto flex h-20 max-w-[88rem] items-center justify-between px-5 sm:h-24 sm:px-8 lg:px-12">
          <Logo href={`/kampan/${campaign.slug}`} />
          <div className="flex items-center gap-5">
            <a href={instagramProfileUrl} target="_blank" rel="noreferrer" className="hidden text-xs font-bold uppercase tracking-[.16em] text-[#6f6d6d] transition hover:text-[var(--accent)] sm:inline">
              @sambike_snv
            </a>
            <a href={telHref(campaign.phone)} data-track="phone" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ink)] transition hover:text-[var(--accent)]">
              <Phone size={16} className="text-[var(--accent)]" />
              <span className="hidden sm:inline">{campaign.phone}</span><span className="sm:hidden">Zavolať</span>
            </a>
          </div>
        </header>

        <div className="mx-auto grid min-h-[calc(88svh-5rem)] max-w-[96rem] lg:grid-cols-[minmax(0,.92fr)_minmax(28rem,1.08fr)]">
          <div className="relative flex items-center overflow-hidden px-5 py-14 sm:px-8 sm:py-20 lg:px-12 lg:py-24 xl:pl-20">
            <Image src={chainLinkElement} alt="" className="pointer-events-none absolute -right-16 top-5 h-auto w-64 rotate-[8deg] opacity-35 sm:right-0 sm:top-10 sm:w-72 lg:-right-20 lg:w-80" />
            <div className="relative z-10 max-w-2xl">
              <div className="mb-8 h-[3px] w-24 bg-[var(--accent)]" />
              <p className="text-xs font-bold uppercase tracking-[.24em] text-[var(--accent)]">{campaign.offerType} · Spišská Nová Ves</p>
              <h1 className="mt-5 max-w-[11ch] text-[clamp(3.15rem,6vw,6.8rem)] font-bold leading-[.91] tracking-[-.065em]">{campaign.headline}</h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-[#626060] sm:text-xl">{campaign.description}</p>
              <p className="mt-6 text-2xl font-bold tracking-[-.025em] text-[var(--ink)] sm:text-3xl">{campaign.priceText}</p>
              <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
                <a href={primaryHref} data-track="cta" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-[3px] bg-[var(--accent)] px-6 py-3 font-bold text-white transition hover:bg-[#075eac]">
                  {campaign.ctaText} <ArrowRight size={18} />
                </a>
                <a href={telHref(campaign.phone)} data-track="phone" className="inline-flex min-h-11 items-center gap-2 border-b border-[#aaa7a7] px-1 font-bold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
                  <Phone size={17} /> Zavolať
                </a>
              </div>
              {campaign.formEnabled && <p className="mt-4 text-xs text-[#858282]">Bez platby vopred <span aria-hidden="true">•</span> Ozveme sa s potvrdením</p>}
            </div>
          </div>

          <div className="relative min-h-[31rem] overflow-hidden bg-[#ecebea] lg:min-h-[calc(88svh-5rem)]">
            <Image src={heroImage} alt={campaign.headline} fill loading="eager" unoptimized={isRemoteHero} sizes="(max-width: 1024px) 100vw, 56vw" className="object-cover saturate-[.92]" />
            <div className="absolute inset-y-0 left-0 hidden w-[5px] bg-[var(--accent)] lg:block" />
            <div className="absolute bottom-7 left-6 size-28 rotate-[-4deg] overflow-hidden rounded-full border-[6px] border-white bg-white shadow-[0_14px_40px_rgba(34,31,31,.18)] sm:bottom-10 sm:left-10 sm:size-36">
              <Image src={wheelBuildPhoto} alt="Detail zapleteného kolesa zo servisu Sambike" fill placeholder="blur" sizes="144px" className="object-cover" />
            </div>
            <span className="absolute bottom-36 left-5 size-4 rounded-full bg-[var(--accent)] sm:bottom-44 sm:left-9" />
            <Image src="/brand/sambike-mark.png" alt="" width={240} height={220} className="absolute bottom-7 right-7 h-auto w-20 opacity-90 sm:bottom-10 sm:right-10 sm:w-24" />
          </div>
        </div>
      </section>

      <section aria-label="Typy bicyklov" className="bg-[var(--ink)] text-white">
        <div className="mx-auto grid max-w-[88rem] grid-cols-2 gap-x-10 gap-y-5 px-5 py-7 text-xs font-bold uppercase tracking-[.28em] sm:grid-cols-4 sm:px-8 lg:px-12">
          <span>Road</span><span>Gravel</span><span className="sm:text-right">MTB</span><span className="text-right">E-bike</span>
        </div>
      </section>

      <section className="relative mx-auto max-w-[88rem] overflow-hidden px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="relative grid gap-12 lg:grid-cols-[.78fr_1.22fr] lg:gap-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-[var(--accent)]">Ako to prebieha</p>
            <h2 className="mt-4 max-w-xl text-4xl font-bold leading-[1.02] tracking-[-.045em] sm:text-5xl">Stačí nám napísať. O zvyšok sa postaráme.</h2>
          </div>
          <ul className="grid gap-8 sm:grid-cols-3" aria-label="Výhody Sambike">
            {benefits.map(({ icon: Icon, title, text }) => (
              <li key={title} className="border-t border-[#d9d7d7] pt-5">
                <Icon size={21} strokeWidth={1.8} className="text-[var(--accent)]" />
                <h3 className="mt-5 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6f6d6d]">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {campaign.formEnabled && (
        <section id="mam-zaujem" data-lead-form-section className="relative scroll-mt-6 overflow-hidden bg-[#f3f3f2]">
          <Image src={chainElement} alt="" className="pointer-events-none absolute -bottom-28 -left-32 h-auto w-[34rem] opacity-[.09] sm:-bottom-40 sm:w-[44rem]" />
          <div className="relative mx-auto grid max-w-[88rem] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[.72fr_1.28fr] lg:gap-20 lg:px-12 lg:py-24">
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[.22em] text-[var(--accent)]">Nezáväzná požiadavka</p>
              <h2 className="mt-4 text-4xl font-bold leading-[1.02] tracking-[-.045em] sm:text-5xl">Dohodnime si podrobnosti</h2>
              <p className="mt-5 max-w-sm leading-relaxed text-[#6f6d6d]">Stačí meno a telefón. Ozveme sa, overíme termín alebo dostupnosť a dohodneme ďalší postup.</p>
              <div className="mt-8 space-y-3 text-sm">
                <a href={telHref(campaign.phone)} data-track="phone" className="flex items-center gap-3 hover:text-[var(--accent)]"><Phone size={17} className="text-[var(--accent)]" />{campaign.phone}</a>
                <a href={`mailto:${campaign.email}`} className="flex items-center gap-3 hover:text-[var(--accent)]"><Mail size={17} className="text-[var(--accent)]" />{campaign.email}</a>
                <a href={instagramProfileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-[var(--accent)]"><AtSign size={17} className="text-[var(--accent)]" />@sambike_snv</a>
                <a href={facebookProfileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-[var(--accent)]"><LinkIcon size={17} className="text-[var(--accent)]" />Facebook</a>
                <p className="flex items-start gap-3 text-[#6f6d6d]"><MapPin size={17} className="mt-0.5 shrink-0 text-[var(--accent)]" />Letná 51, Spišská Nová Ves</p>
              </div>
              <Image src={chainLubeElement} alt="" className="mt-8 h-auto w-36 rotate-[-4deg] drop-shadow-[0_12px_22px_rgba(34,31,31,.12)] sm:w-40 lg:mt-10 lg:w-44" />
            </div>
            <LeadForm campaignId={campaign.id} campaignSlug={campaign.slug} offerType={campaign.offerType} />
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-[88rem] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:px-12 lg:py-24">
        <div className="relative pb-3 pl-3">
          <div className="absolute inset-x-0 bottom-0 top-3 rounded-[1.4rem] border-2 border-[var(--accent)]" />
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.4rem] bg-[#ecebea]">
            <Image src={offerImage} alt={campaign.headline} fill unoptimized={typeof offerImage === "string" && /^https?:\/\//.test(offerImage)} sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          </div>
          <Image src={serviceToolsElement} alt="" className="absolute -bottom-12 -right-12 h-auto w-52 rotate-[-3deg] drop-shadow-[0_10px_18px_rgba(34,31,31,.16)] sm:-bottom-16 sm:-right-16 sm:w-60" />
        </div>
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-[var(--accent)]">Aktuálna ponuka</p>
          <h2 className="mt-4 text-4xl font-bold leading-[1.02] tracking-[-.045em] sm:text-5xl">{campaign.name}</h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#6f6d6d]">{campaign.description}</p>
          <div className="mt-8 border-t border-[#d9d7d7] pt-6">
            <span className="block text-xs font-bold uppercase tracking-[.17em] text-[#858282]">Cena a podmienky</span>
            <strong className="mt-2 block text-2xl text-[var(--ink)]">{campaign.priceText}</strong>
          </div>
          <a href={primaryHref} data-track="cta" className="mt-8 inline-flex items-center gap-2 font-bold text-[var(--accent)]">{campaign.ctaText} <ArrowRight size={17} /></a>
        </div>
      </section>

      <section className="mx-auto max-w-[88rem] px-5 pb-16 sm:px-8 lg:px-12 lg:pb-24">
        <div className="relative border-t border-[#d9d7d7] pt-12">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-[var(--accent)]">Práca zo servisu</p>
          <div className="mt-4 grid gap-7 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-end lg:grid-cols-[minmax(0,1fr)_18rem]">
            <h2 className="max-w-3xl text-4xl font-bold leading-[1.02] tracking-[-.045em] sm:text-5xl">Bicykel skontrolujeme do posledného detailu.</h2>
            <div className="flex items-end justify-between gap-4 sm:block">
              <p className="max-w-sm text-sm leading-relaxed text-[#6f6d6d]">Kontrola · čistý pohon · správny tlak · nastavenie podľa jazdca</p>
              <Image src={tireElement} alt="" className="h-auto w-32 shrink-0 sm:mt-5 sm:w-48 lg:w-56" />
            </div>
          </div>
        </div>
        <div className="mt-10 grid gap-x-6 gap-y-9 sm:grid-cols-12">
          {servicePhotos.map((photo) => (
            <figure key={photo.caption} className={photo.layout}>
              <div className="group relative aspect-[4/3] overflow-hidden rounded-[1.15rem] bg-[#ecebea] sm:aspect-[16/10]">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  placeholder={typeof photo.src === "string" ? undefined : "blur"}
                  unoptimized={typeof photo.src === "string" && /^https?:\/\//.test(photo.src)}
                  sizes="(max-width: 640px) 100vw, 58vw"
                  className="object-cover transition duration-700 group-hover:scale-[1.025]"
                  style={{ objectPosition: photo.position ?? "center" }}
                />
                <span className="absolute right-4 top-4 size-3 rounded-full border-[3px] border-white bg-[var(--accent)] shadow-sm" />
              </div>
              <figcaption className="mt-3 flex items-center gap-2 text-xs text-[#777474]"><span className="h-px w-5 bg-[var(--accent)]" />{photo.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-[var(--ink)] text-white">
        <Image src={cranksetElement} alt="" className="pointer-events-none absolute -right-32 -top-6 h-auto w-[26rem] opacity-20 lg:left-[34%] lg:right-auto lg:top-0 lg:w-[38rem] lg:opacity-35" />
        <div className="relative mx-auto grid max-w-[88rem] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_380px] lg:px-12 lg:py-24">
          <div className="max-w-xl">
            <Image src="/brand/sambike-mark.png" alt="" width={240} height={220} className="h-auto w-16" />
            <p className="mt-8 text-xs font-bold uppercase tracking-[.22em] text-[#4ca3ef]">Zo servisu</p>
            <h2 className="mt-4 text-4xl font-bold leading-[1.02] tracking-[-.045em] sm:text-6xl">Pozrite sa, ako pracujeme.</h2>
            <p className="mt-5 text-lg leading-relaxed text-white/65">Krátke video priamo z našej dielne v Spišskej Novej Vsi.</p>
            <a href={facebookReelUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-2 border-b border-white/40 pb-1 text-sm font-bold transition hover:border-[#4ca3ef] hover:text-[#4ca3ef]"><Play size={16} fill="currentColor" /> Pozrieť video na Facebooku <ExternalLink size={14} /></a>
          </div>
          <div className="mx-auto w-full max-w-[380px] rotate-[1deg] overflow-hidden rounded-[1.5rem] border-[6px] border-white/10 bg-black">
            <iframe src={facebookEmbedUrl} title="Sambike video z Facebooku" width="500" height="750" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen className="aspect-[9/16] h-auto w-full" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[88rem] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[.7fr_1.3fr] lg:px-12 lg:py-24">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.22em] text-[var(--accent)]">Praktické informácie</p>
          <h2 className="mt-4 text-4xl font-bold tracking-[-.045em] sm:text-5xl">Časté otázky</h2>
        </div>
        <div>
          {faq.map((item, index) => (
            <details key={item.question} className="group border-t border-[#d9d7d7] py-1" open={index === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 font-bold marker:content-none">{item.question}<span className="text-2xl font-normal text-[var(--accent)] transition group-open:rotate-45" aria-hidden="true">+</span></summary>
              <p className="max-w-2xl pb-5 pr-10 leading-relaxed text-[#6f6d6d]">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section data-final-cta className="relative overflow-hidden bg-[var(--accent)] px-5 py-16 text-white sm:px-8 lg:px-12 lg:py-20">
        <Image src={helmetElement} alt="" className="pointer-events-none absolute -bottom-20 -right-32 h-auto w-[28rem] opacity-20 lg:-bottom-24 lg:left-[36%] lg:right-auto lg:w-[34rem] lg:opacity-30" />
        <div className="relative mx-auto flex max-w-[88rem] flex-col items-start justify-between gap-9 sm:flex-row sm:items-center">
          <div><p className="text-xs font-bold uppercase tracking-[.22em] text-white/70">Bez platby vopred</p><h2 className="mt-3 max-w-3xl text-4xl font-bold leading-[1.02] tracking-[-.045em] sm:text-5xl">Pošlite nám nezáväznú požiadavku.</h2></div>
          <div className="flex shrink-0 flex-wrap items-center gap-5">
            <a href={primaryHref} data-track="cta" className="inline-flex min-h-12 items-center gap-2 rounded-[3px] bg-[var(--ink)] px-6 py-3 font-bold text-white">{campaign.ctaText} <ArrowRight size={17} /></a>
            <a href={telHref(campaign.phone)} data-track="phone" className="inline-flex items-center gap-2 font-bold text-white"><Phone size={17} /> Zavolať</a>
          </div>
        </div>
      </section>

      <footer className="bg-[var(--ink)] px-5 py-9 text-white sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[88rem] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Logo href={`/kampan/${campaign.slug}`} light />
          <div className="flex flex-col gap-1 text-xs text-white/55 sm:text-right">
            <span>Letná 51 · Spišská Nová Ves</span>
            <span>© {new Date().getFullYear()} Sambike · servis bicyklov</span>
          </div>
        </div>
      </footer>

      <MobileStickyCta ctaText={campaign.ctaText} primaryHref={primaryHref} phone={campaign.phone} />
    </main>
  );
}
