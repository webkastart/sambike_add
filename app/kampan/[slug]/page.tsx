import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import {
  ArrowRight,
  AtSign,
  Check,
  Clock3,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { CampaignTracking } from "@/components/campaign-tracking";
import { LeadForm } from "@/components/lead-form";
import { MobileStickyCta } from "@/components/mobile-sticky-cta";
import { Logo } from "@/components/logo";
import { telHref } from "@/lib/format";
import { createLeadFormToken } from "@/lib/lead-protection";
import { prisma } from "@/lib/prisma";
import { verifyCampaignPreviewToken } from "@/lib/campaign-workflow";
import { resolveCampaignSections, sectionContentString } from "@/lib/campaign-sections";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string; variant?: string }> };
type TextItem = { title: string; text: string };
type FaqItem = { question: string; answer: string };
type TestimonialItem = { name: string; text: string };

const instagramProfileUrl = "https://www.instagram.com/sambike_snv/";
const fallbackBenefits: TextItem[] = [
  { title: "Jasný termín", text: "Dostupný termín si spolu potvrdíme telefonicky." },
  { title: "Osobný prístup", text: "Najprv si vypočujeme problém a navrhneme ďalší postup." },
  { title: "Spoľahlivý výsledok", text: "Bicykel skontrolujeme s dôrazom na bezpečnosť a detail." },
];
const fallbackFaq: FaqItem[] = [
  { question: "Ako si objednám servis?", answer: "Vyplňte krátky formulár alebo nám zavolajte. Následne spolu potvrdíme termín a ďalší postup." },
  { question: "Kedy budem poznať termín?", answer: "Po prijatí požiadavky sa vám ozveme na uvedené telefónne číslo a overíme dostupný termín." },
  { question: "Čo mám uviesť do poznámky?", answer: "Napíšte typ bicykla, stručný opis problému a želaný termín." },
];

function textItems(value: unknown): TextItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    return typeof record.title === "string" && typeof record.text === "string"
      ? [{ title: record.title, text: record.text }]
      : [];
  });
}

function faqItems(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    return typeof record.question === "string" && typeof record.answer === "string"
      ? [{ question: record.question, answer: record.answer }]
      : [];
  });
}

function testimonialItems(value: unknown): TestimonialItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    return typeof record.name === "string" && typeof record.text === "string"
      ? [{ name: record.name, text: record.text }]
      : [];
  });
}

function isRemoteMedia(src: string) {
  return /^https?:\/\//.test(src);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const campaign = await prisma.campaign.findUnique({ where: { slug } });
  if (!campaign) return {};
  const preview = verifyCampaignPreviewToken(query.preview, campaign.id);
  const indexable = campaign.status === "PUBLISHED" && !campaign.noIndex && !preview;
  const canonical = campaign.canonicalUrl || (process.env.APP_URL ? new URL(`/kampan/${campaign.slug}`, process.env.APP_URL).toString() : undefined);
  return {
    title: campaign.seoTitle || campaign.headline,
    description: campaign.seoDescription || campaign.description,
    alternates: indexable && canonical ? { canonical } : undefined,
    robots: { index: indexable, follow: indexable },
    openGraph: {
      title: campaign.ogTitle || campaign.seoTitle || campaign.headline,
      description: campaign.ogDescription || campaign.seoDescription || campaign.description,
      url: canonical,
      images: [campaign.ogImageUrl || campaign.imageUrl || "/og.png"],
    },
  };
}

export default async function CampaignLandingPage({ params, searchParams }: Props) {
  const [{ slug }, query, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    include: { galleryItems: { orderBy: { sortOrder: "asc" } }, sections: { orderBy: { position: "asc" } }, experiment: true },
  });
  if (!campaign) notFound();

  const preview = verifyCampaignPreviewToken(query.preview, campaign.id);
  if (campaign.status !== "PUBLISHED" && !preview) notFound();
  const requestedPreviewVariant = preview && query.variant === "B" ? "B" : preview ? "A" : null;
  const assigned = cookieStore.get(`sambike_variant_${campaign.slug}`)?.value === "B" ? "B" : "A";
  const variant: "A" | "B" = requestedPreviewVariant || (campaign.experiment?.status === "RUNNING" ? assigned : "A");
  const useVariantB = variant === "B" && Boolean(campaign.experiment);
  const heroMedia = campaign.galleryItems.find((item) => item.placement === "HERO" && item.mediaType === "IMAGE");
  const offerMedia = campaign.galleryItems.find((item) => item.placement === "OFFER" && item.mediaType === "IMAGE");
  const beforeMedia = campaign.galleryItems.find((item) => item.placement === "BEFORE" && item.mediaType === "IMAGE");
  const afterMedia = campaign.galleryItems.find((item) => item.placement === "AFTER" && item.mediaType === "IMAGE");
  const galleryMedia = campaign.galleryItems.filter((item) => !["HERO", "OFFER", "BEFORE", "AFTER"].includes(item.placement));
  const sections = resolveCampaignSections(campaign).filter((section) => section.isVisible);
  const heroSection = sections.find((section) => section.type === "HERO");
  const baseHeadline = heroSection ? sectionContentString(heroSection.content, "heading", campaign.headline) : campaign.headline;
  const baseDescription = heroSection ? sectionContentString(heroSection.content, "description", campaign.description) : campaign.description;
  const baseCtaText = heroSection ? sectionContentString(heroSection.content, "ctaLabel", campaign.ctaText) : campaign.ctaText;
  const baseHeroImage = heroSection ? sectionContentString(heroSection.content, "imageUrl", heroMedia?.mediaUrl || campaign.imageUrl) : heroMedia?.mediaUrl || campaign.imageUrl;
  const headline = useVariantB ? campaign.experiment?.variantHeadline || baseHeadline : baseHeadline;
  const description = useVariantB ? campaign.experiment?.variantDescription || baseDescription : baseDescription;
  const ctaText = useVariantB ? campaign.experiment?.variantCtaText || baseCtaText : baseCtaText;
  const heroImage = useVariantB ? campaign.experiment?.variantImageUrl || baseHeroImage : baseHeroImage;
  const offerImage = offerMedia?.mediaUrl || campaign.offerImageUrl || campaign.imageUrl;
  const hasVisibleForm = sections.some((section) => section.type === "FORM");
  const primaryHref = hasVisibleForm ? "#mam-zaujem" : `mailto:${campaign.email}`;
  const benefits = textItems(campaign.benefits);
  const displayedBenefits = benefits.length ? benefits : fallbackBenefits;
  const processSteps = textItems(heroSection?.content.steps ?? campaign.processSteps);
  const faq = faqItems(campaign.faq);
  const displayedFaq = faq.length ? faq : fallbackFaq;
  const pixelId = /^\d+$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "") ? process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() : undefined;
  const formToken = createLeadFormToken(campaign.id);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined;
  const canonical = campaign.canonicalUrl || (process.env.APP_URL ? new URL(`/kampan/${campaign.slug}`, process.env.APP_URL).toString() : undefined);
  const jsonLd = campaign.address ? {
    "@context": "https://schema.org",
    "@type": "Service",
    name: campaign.name,
    description,
    url: canonical,
    image: heroImage,
    provider: { "@type": "LocalBusiness", name: "Sambike", address: campaign.address, telephone: campaign.phone, email: campaign.email },
  } : null;
  const detailRows = [
    ["Ponuka", campaign.name],
    ["Cena a podmienky", campaign.priceText],
    ...(campaign.responseTimeText ? [["Odpoveď", campaign.responseTimeText]] : []),
  ];

  const renderSection = (section: (typeof sections)[number]) => {
    const content = section.content;
    const eyebrow = sectionContentString(content, "eyebrow");
    const heading = sectionContentString(content, "heading");
    const sectionDescription = sectionContentString(content, "description");

    if (section.type === "HERO") {
      const sectionHeadline = useVariantB ? headline : heading || headline;
      const sectionCopy = useVariantB ? description : sectionDescription || description;
      const sectionCta = useVariantB ? ctaText : sectionContentString(content, "ctaLabel", ctaText);
      const sectionImage = useVariantB ? heroImage : sectionContentString(content, "imageUrl", heroImage);
      return <section data-campaign-hero className="mx-auto grid max-w-[82rem] gap-5 px-4 pb-16 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:gap-7 lg:pb-24">
        <article className="overflow-hidden rounded-[2rem] bg-white sm:rounded-[2.75rem]">
          <div className="relative aspect-[4/3] min-h-[23rem] bg-[#dfe3dc] sm:aspect-[16/11] lg:min-h-[35rem]"><Image src={sectionImage} alt={heroMedia?.caption || sectionHeadline} fill loading="eager" fetchPriority="high" unoptimized={isRemoteMedia(sectionImage)} sizes="(max-width: 1024px) 100vw, 56vw" className="object-cover" />{heroMedia?.caption && <p className="absolute bottom-5 left-5 max-w-[80%] rounded-full bg-white/92 px-4 py-2 text-xs font-medium backdrop-blur-sm sm:bottom-7 sm:left-7">{heroMedia.caption}</p>}</div>
          <div className="relative -mt-9 rounded-t-[2rem] bg-white px-6 pb-7 pt-8 sm:-mt-12 sm:rounded-t-[2.75rem] sm:px-10 sm:pb-10 sm:pt-11"><div className="mx-auto mb-7 h-1 w-10 rounded-full bg-[var(--accent)]" /><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow || campaign.offerType} · Spišská Nová Ves</p><h1 className="mt-4 max-w-2xl text-4xl font-bold leading-[.98] tracking-[-.045em] sm:text-5xl lg:text-[3.55rem]">{sectionHeadline}</h1><p className="mt-5 max-w-2xl text-base leading-relaxed text-[#686b68] sm:text-lg">{sectionCopy}</p><div className="mt-7 flex flex-wrap items-center gap-4"><a href={primaryHref} data-track="cta" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--accent-dark)]">{sectionCta}<ArrowRight size={17} /></a><a href={telHref(campaign.phone)} data-track="phone" className="inline-flex min-h-12 items-center gap-2 px-2 text-sm font-semibold hover:text-[var(--accent)]"><Phone size={16} /> Zavolať</a></div></div>
        </article>
        <aside className="flex min-h-[38rem] flex-col rounded-[2rem] bg-white p-6 sm:rounded-[2.75rem] sm:p-9 lg:min-h-full"><div className="flex items-start justify-between"><Image src="/brand/sambike-mark.png" alt="" width={240} height={220} className="h-auto w-14" /><span className="size-2.5 rounded-full bg-[var(--accent)]" aria-hidden="true" /></div><div className="mx-auto my-10 max-w-sm text-center lg:my-14"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">Detail kampane</p><h2 className="mt-3 text-3xl font-bold tracking-[-.04em]">Všetko podstatné na jednom mieste.</h2></div><dl className="space-y-3">{detailRows.map(([label, value]) => <div key={label} className="rounded-[1.15rem] bg-[#f4f5f2] px-5 py-4"><dt className="text-xs font-medium text-[#7a7e79]">{label}</dt><dd className="mt-1 text-sm font-semibold leading-relaxed">{value}</dd></div>)}</dl>{processSteps.length > 0 && <ol className="mt-6 space-y-4">{processSteps.slice(0, 3).map((step, index) => <li key={step.title} className="flex gap-3 text-sm"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e9f3fc] text-xs font-bold text-[var(--accent)]">{index + 1}</span><span><strong className="block">{step.title}</strong><span className="mt-0.5 block text-[#747774]">{step.text}</span></span></li>)}</ol>}<a href={primaryHref} data-track="cta" className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--accent-dark)]">{sectionCta}<ArrowRight size={17} /></a></aside>
      </section>;
    }

    if (section.type === "BENEFITS") {
      const items = textItems(content.items);
      const shown = items.length ? items : displayedBenefits;
      return <><section className="mx-auto max-w-[82rem] px-5 pb-16 sm:px-8 lg:pb-24"><div className="grid gap-10 border-y border-[#d8dcd6] py-12 lg:grid-cols-[.72fr_1.28fr] lg:gap-20 lg:py-16"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow || "Prečo Sambike"}</p><h2 className="mt-4 whitespace-pre-line text-4xl font-bold leading-[1.02] tracking-[-.045em]">{heading || "Jemný prístup. Poctivý servis."}</h2></div><ul className="grid gap-8 sm:grid-cols-3">{shown.slice(0, 8).map((item, index) => { const Icon = [Clock3, Wrench, ShieldCheck][index % 3]; return <li key={`${item.title}-${index}`} className="border-t border-[#cfd3cd] pt-5"><Icon size={21} strokeWidth={1.7} className="text-[var(--accent)]" /><h3 className="mt-4 font-bold">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-[#70736f]">{item.text}</p></li>; })}</ul></div></section>{campaign.trustText && <aside className="mx-auto mb-16 max-w-[82rem] px-5 text-center text-sm font-semibold text-[#5f625f] sm:px-8" aria-label="Dôveryhodnostná informácia">{campaign.trustText}</aside>}</>;
    }

    if (section.type === "OFFER") {
      const image = sectionContentString(content, "imageUrl", offerImage);
      const label = sectionContentString(content, "ctaLabel", ctaText);
      return <section className="mx-auto grid max-w-[82rem] gap-5 px-4 pb-16 sm:px-8 lg:grid-cols-2 lg:gap-7 lg:pb-24"><figure className="overflow-hidden rounded-[2rem] bg-white sm:rounded-[2.75rem]"><div className="relative aspect-[4/3] bg-[#e2e4e0]"><Image src={image} alt={offerMedia?.caption || heading || campaign.name} fill unoptimized={isRemoteMedia(image)} sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" /></div>{offerMedia?.caption && <figcaption className="px-6 py-5 text-sm text-[#6f726f] sm:px-8">{offerMedia.caption}</figcaption>}</figure><div className="flex flex-col justify-center rounded-[2rem] bg-white px-6 py-10 sm:rounded-[2.75rem] sm:px-10 lg:px-12"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow || "Aktuálna ponuka"}</p><h2 className="mt-4 text-4xl font-bold leading-[1.02] tracking-[-.045em] sm:text-5xl">{heading || campaign.name}</h2><p className="mt-5 text-lg leading-relaxed text-[#6f726f]">{sectionDescription || description}</p><div className="mt-8 rounded-[1.15rem] bg-[#f4f5f2] px-5 py-4"><span className="block text-xs text-[#7a7e79]">Cena a podmienky</span><strong className="mt-1 block text-xl">{sectionContentString(content, "priceText", campaign.priceText)}</strong></div><a href={primaryHref} data-track="cta" className="mt-7 inline-flex items-center gap-2 self-start text-sm font-bold text-[var(--accent)]">{label}<ArrowRight size={16} /></a></div></section>;
    }

    if (section.type === "FORM") return <section id="mam-zaujem" data-lead-form-section className="mx-auto max-w-[82rem] scroll-mt-6 px-4 pb-16 sm:px-8 lg:pb-24"><div className="grid gap-12 rounded-[2rem] bg-white px-6 py-10 sm:rounded-[2.75rem] sm:px-10 lg:grid-cols-[.72fr_1.28fr] lg:gap-20 lg:px-12 lg:py-14"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow || "Nezáväzná požiadavka"}</p><h2 className="mt-4 text-4xl font-bold leading-[1.02] tracking-[-.045em] sm:text-5xl">{heading || "Dohodnime si podrobnosti."}</h2><p className="mt-5 max-w-sm leading-relaxed text-[#6f726f]">{sectionDescription || campaign.responseTimeText || "Stačí meno a telefón. Ozveme sa a spolu dohodneme termín aj rozsah."}</p><div className="mt-8 space-y-3 text-sm"><a href={telHref(campaign.phone)} data-track="phone" className="flex items-center gap-3 hover:text-[var(--accent)]"><Phone size={17} className="text-[var(--accent)]" />{campaign.phone}</a><a href={`mailto:${campaign.email}`} className="flex items-center gap-3 hover:text-[var(--accent)]"><Mail size={17} className="text-[var(--accent)]" />{campaign.email}</a><a href={instagramProfileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-[var(--accent)]"><AtSign size={17} className="text-[var(--accent)]" />@sambike_snv</a>{campaign.address && (campaign.mapUrl ? <a href={campaign.mapUrl} target="_blank" rel="noreferrer" className="flex items-start gap-3 text-[#6f726f] hover:text-[var(--accent)]"><MapPin size={17} className="mt-0.5 shrink-0 text-[var(--accent)]" />{campaign.address}</a> : <p className="flex items-start gap-3 text-[#6f726f]"><MapPin size={17} className="mt-0.5 shrink-0 text-[var(--accent)]" />{campaign.address}</p>)}{campaign.openingHours && <p className="flex items-start gap-3 text-[#6f726f]"><Clock3 size={17} className="mt-0.5 shrink-0 text-[var(--accent)]" />{campaign.openingHours}</p>}</div></div>{preview ? <div className="self-center border-y border-[#d9dcd7] py-10 text-center" role="status"><p className="font-semibold">Formulár je v náhľade bezpečne vypnutý.</p><p className="mt-2 text-sm text-[#6f726f]">Náhľad nevytvorí lead ani neodošle e-mail.</p></div> : <LeadForm campaignId={campaign.id} campaignSlug={campaign.slug} offerType={campaign.offerType} formToken={formToken} turnstileSiteKey={turnstileSiteKey} variant={variant} />}</div></section>;

    if (section.type === "GALLERY") {
      const media = galleryMedia.filter((item) => !item.sectionId || item.sectionId === section.id);
      return <>{(beforeMedia || afterMedia) && <section className="mx-auto max-w-[82rem] px-4 pb-16 sm:px-8 lg:pb-24"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">Pred a po</p><h2 className="mt-4 text-4xl font-bold tracking-[-.045em] sm:text-5xl">Rozdiel, ktorý je vidieť.</h2><div className="mt-8 grid gap-5 sm:grid-cols-2">{([[beforeMedia, "Pred servisom"], [afterMedia, "Po servise"]] as const).flatMap(([item, label]) => item ? [<figure key={item.id} className="overflow-hidden rounded-[2rem] bg-white"><div className="relative aspect-[4/3] bg-[#dfe2dd]"><Image src={item.mediaUrl} alt={item.caption || label} fill unoptimized={isRemoteMedia(item.mediaUrl)} sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" /></div><figcaption className="px-6 py-5 text-sm font-semibold">{label}{item.caption ? ` · ${item.caption}` : ""}</figcaption></figure>] : [])}</div></section>}{media.length > 0 && <section className="mx-auto max-w-[82rem] px-4 pb-16 sm:px-8 lg:pb-24"><div className="mb-9 sm:flex sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow || "Práca zo servisu"}</p><h2 className="mt-4 text-4xl font-bold tracking-[-.045em] sm:text-5xl">{heading || "Detail, ktorý je vidieť."}</h2></div>{sectionDescription && <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#70736f] sm:mt-0">{sectionDescription}</p>}</div><div className="grid gap-5 sm:grid-cols-2">{media.map((item, index) => { const label = item.caption || `${campaign.name} – ${item.mediaType === "VIDEO" ? "video" : "fotografia"} ${index + 1}`; return <figure key={item.id} className={`overflow-hidden rounded-[2rem] bg-white sm:rounded-[2.5rem] ${media.length % 2 === 1 && index === media.length - 1 ? "sm:col-span-2" : ""}`}><div className={`relative bg-[#dfe2dd] ${media.length % 2 === 1 && index === media.length - 1 ? "aspect-[4/3] sm:aspect-[21/9]" : "aspect-[4/3]"}`}>{item.mediaType === "VIDEO" ? <video src={item.mediaUrl} aria-label={label} controls muted playsInline preload="metadata" className="size-full object-cover" /> : <Image src={item.mediaUrl} alt={label} fill unoptimized={isRemoteMedia(item.mediaUrl)} sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />}</div><figcaption className="flex items-center gap-3 px-6 py-5 text-sm text-[#666a66]"><span className="flex size-6 items-center justify-center rounded-full bg-[#e9f3fc] text-[var(--accent)]"><Check size={13} strokeWidth={2.4} /></span>{item.caption || `${item.mediaType === "VIDEO" ? "Video" : "Zo servisu"} · ${String(index + 1).padStart(2, "0")}`}</figcaption></figure>; })}</div></section>}</>;
    }

    if (section.type === "FAQ") {
      const items = faqItems(content.items);
      const shown = items.length ? items : displayedFaq;
      return <section className="mx-auto grid max-w-[82rem] gap-10 px-4 pb-16 sm:px-8 lg:grid-cols-[.65fr_1.35fr] lg:gap-20 lg:pb-24"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow || "Praktické informácie"}</p><h2 className="mt-4 text-4xl font-bold tracking-[-.045em] sm:text-5xl">{heading || "Časté otázky."}</h2></div><div className="overflow-hidden rounded-[2rem] bg-white px-6 sm:rounded-[2.5rem] sm:px-8">{shown.map((item, index) => <details key={`${item.question}-${index}`} className="group border-b border-[#e0e3de] py-1 last:border-0" open={index === 0}><summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 font-bold marker:content-none">{item.question}<span className="text-2xl font-normal text-[var(--accent)] transition group-open:rotate-45" aria-hidden="true">+</span></summary><p className="max-w-2xl pb-6 pr-10 leading-relaxed text-[#6f726f]">{item.answer}</p></details>)}</div></section>;
    }

    if (section.type === "TESTIMONIALS") {
      const items = testimonialItems(content.items);
      if (!items.length) return null;
      return <section className="mx-auto max-w-[82rem] px-4 pb-16 sm:px-8 lg:pb-24"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow || "Referencie zákazníkov"}</p>{heading && <h2 className="mt-4 text-4xl font-bold tracking-[-.045em] sm:text-5xl">{heading}</h2>}<ul className="mt-6 grid gap-5 md:grid-cols-2">{items.map((item, index) => <li key={`${item.name}-${index}`} className="rounded-[2rem] bg-white p-7 sm:p-9"><blockquote className="text-lg leading-relaxed text-[#5f625f]">„{item.text}“</blockquote><p className="mt-5 text-sm font-bold">{item.name}</p></li>)}</ul></section>;
    }

    if (section.type === "CTA") {
      const href = sectionContentString(content, "href", primaryHref);
      return <section data-final-cta className="mx-auto max-w-[82rem] px-4 pb-5 sm:px-8"><div className="flex flex-col items-start justify-between gap-8 rounded-[2rem] bg-[var(--accent)] px-6 py-10 text-white sm:rounded-[2.75rem] sm:px-10 lg:flex-row lg:items-center lg:px-12 lg:py-14"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-white/70">{eyebrow || "Dohodnite si termín"}</p><h2 className="mt-3 max-w-3xl text-4xl font-bold leading-[1.02] tracking-[-.045em] sm:text-5xl">{heading || campaign.finalCtaText || "Pošlite nám nezáväznú požiadavku."}</h2>{sectionDescription && <p className="mt-4 max-w-2xl text-white/80">{sectionDescription}</p>}</div><div className="flex shrink-0 flex-wrap items-center gap-5"><a href={href} data-track="cta" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-bold text-white">{sectionContentString(content, "ctaLabel", ctaText)}<ArrowRight size={17} /></a><a href={telHref(campaign.phone)} data-track="phone" className="inline-flex items-center gap-2 text-sm font-bold"><Phone size={17} /> Zavolať</a></div></div></section>;
    }

    if (section.type === "TEXT_IMAGE") {
      const image = sectionContentString(content, "imageUrl");
      return <section className="mx-auto grid max-w-[82rem] gap-8 px-4 pb-16 sm:px-8 lg:grid-cols-2 lg:items-center lg:pb-24">{image && <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-[#dfe2dd] sm:rounded-[2.75rem]"><Image src={image} alt={sectionContentString(content, "imageAlt", heading)} fill unoptimized={isRemoteMedia(image)} sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" /></div>}<div className="px-2 py-4 lg:px-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow}</p><h2 className="mt-4 text-4xl font-bold tracking-[-.045em] sm:text-5xl">{heading}</h2><p className="mt-5 text-lg leading-relaxed text-[#6f726f]">{sectionDescription}</p></div></section>;
    }

    if (section.type === "VIDEO") {
      const videoUrl = sectionContentString(content, "videoUrl");
      if (!videoUrl) return null;
      // User-provided videos do not have a separate caption-file field; the adjacent caption remains available as text.
      // eslint-disable-next-line jsx-a11y/media-has-caption
      return <section className="mx-auto max-w-[82rem] px-4 pb-16 sm:px-8 lg:pb-24"><div className="mb-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow || "Video"}</p><h2 className="mt-4 text-4xl font-bold tracking-[-.045em] sm:text-5xl">{heading}</h2>{sectionDescription && <p className="mt-4 max-w-2xl text-[#70736f]">{sectionDescription}</p>}</div><figure className="overflow-hidden rounded-[2rem] bg-white sm:rounded-[2.75rem]"><video src={videoUrl} controls playsInline preload="metadata" className="aspect-video w-full bg-black object-contain" />{sectionContentString(content, "caption") && <figcaption className="px-6 py-5 text-sm text-[#666a66]">{sectionContentString(content, "caption")}</figcaption>}</figure></section>;
    }

    return null;
  };

  return (
    <main className="campaign-page min-h-screen bg-[#f3f4f1] text-[var(--ink)]">
      {preview && (
        <div className="sticky top-0 z-[80] flex flex-wrap items-center justify-center gap-3 bg-[#fff4cc] px-4 py-2 text-center text-sm font-semibold text-[#684f00]" role="status">
          Náhľad konceptu · variant {variant} · formulár a analytika sú vypnuté
          <Link className="underline" href={`/kampan/${campaign.slug}?preview=${encodeURIComponent(query.preview!)}&variant=${variant === "A" ? "B" : "A"}`}>Zobraziť variant {variant === "A" ? "B" : "A"}</Link>
        </div>
      )}
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}

      <header className="mx-auto flex h-20 max-w-[82rem] items-center justify-between px-5 sm:h-24 sm:px-8">
        <Logo href={`/kampan/${campaign.slug}`} />
        <div className="flex items-center gap-5">
          <a href={instagramProfileUrl} target="_blank" rel="noreferrer" className="hidden text-xs font-semibold tracking-[.08em] text-[#6e706e] transition hover:text-[var(--accent)] sm:inline">@sambike_snv</a>
          <a href={telHref(campaign.phone)} data-track="phone" className="inline-flex items-center gap-2 text-sm font-semibold transition hover:text-[var(--accent)]">
            <Phone size={16} className="text-[var(--accent)]" />
            <span className="hidden sm:inline">{campaign.phone}</span><span className="sm:hidden">Zavolať</span>
          </a>
        </div>
      </header>
      {sections.map((section) => <div key={section.id} className="contents">{renderSection(section)}</div>)}

      <footer className="px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-[82rem] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Logo href={`/kampan/${campaign.slug}`} />
          <div className="flex flex-col gap-1 text-xs text-[#747774] sm:text-right">{campaign.address && <span>{campaign.address}</span>}<span>© {new Date().getFullYear()} Sambike · servis bicyklov</span><Link href={campaign.legalUrl} className="underline underline-offset-2">Ochrana osobných údajov</Link>{!preview && <CampaignTracking campaignSlug={campaign.slug} pixelId={pixelId} variant={variant} />}</div>
        </div>
      </footer>

      <MobileStickyCta ctaText={ctaText} primaryHref={primaryHref} phone={campaign.phone} />
    </main>
  );
}
