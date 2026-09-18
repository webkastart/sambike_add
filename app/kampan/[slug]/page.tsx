import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import {
  ArrowRight,
  AtSign,
  Bike,
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
import { getMetaPixelSettings } from "@/lib/meta-pixel";
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
const serviceBenefitIllustrations = ["service-check", "wrench", "disc-rotor"] as const;
type ServiceBenefitIllustrationName = (typeof serviceBenefitIllustrations)[number];
type ServiceIllustrationName =
  | "chain-lube"
  | "service-tools"
  | "helmet"
  | "chain"
  | "chain-link"
  | "crankset"
  | "tire";

function ServiceIllustration({ name, className = "" }: { name: ServiceIllustrationName; className?: string }) {
  return (
    <Image
      src={`/illustrations/service-classic/${name}.png`}
      alt=""
      width={1122}
      height={876}
      aria-hidden="true"
      className={`object-contain ${className}`}
    />
  );
}

function ServiceBenefitIllustration({ name, className = "", size = 48 }: { name: ServiceBenefitIllustrationName; className?: string; size?: number }) {
  return <Image src={`/illustrations/service-parts-minimal/${name}.png`} alt="" width={size} height={size} aria-hidden="true" className={`object-contain ${className}`} style={{ width: size, height: size }} />;
}

function BikeCta({ href, label, className = "" }: { href: string; label: string; className?: string }) {
  return (
    <a
      href={href}
      data-track="cta"
      className={`group inline-flex min-h-11 items-center gap-1 rounded-full bg-[#221f1f] p-1 pr-2 text-white shadow-[0_12px_26px_rgba(34,31,31,.18)] ring-1 ring-black/10 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(34,31,31,.26)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0971ce]/25 active:translate-y-0 active:scale-[.98] sm:min-h-14 sm:gap-3 sm:p-2 sm:pr-3 sm:shadow-[0_14px_30px_rgba(34,31,31,.2)] ${className}`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] shadow-[inset_0_1px_0_rgba(255,255,255,.28)] sm:size-10" aria-hidden="true">
        <Bike strokeWidth={2.1} className="size-[17px] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:size-[21px]" />
      </span>
      <span className="px-1 text-xs font-bold tracking-[-.01em] sm:text-sm">{label}</span>
      <span className="ml-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#74c2ff] transition duration-200 group-hover:translate-x-0.5 group-hover:bg-white group-hover:text-[var(--accent)] sm:ml-1 sm:size-9" aria-hidden="true">
        <ArrowRight className="size-4 sm:size-[17px]" strokeWidth={2.2} />
      </span>
    </a>
  );
}

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
  const [campaign, metaPixel] = await Promise.all([
    prisma.campaign.findUnique({
      where: { slug },
      include: { galleryItems: { orderBy: { sortOrder: "asc" } }, sections: { orderBy: { position: "asc" } }, experiment: true },
    }),
    getMetaPixelSettings(),
  ]);
  if (!campaign) notFound();
  const showServiceParts = campaign.slug === "servis";

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
  const pixelId = metaPixel.enabled ? metaPixel.pixelId ?? undefined : undefined;
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
        <article className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_70px_rgba(28,38,31,.08)] ring-1 ring-black/[.035] sm:rounded-[2.75rem]">
          <div className="relative bg-[#dfe3dc]" style={{ height: "clamp(14rem, 62.5vw, 27rem)" }}><Image src={sectionImage} alt={heroMedia?.caption || sectionHeadline} fill quality={90} loading="eager" fetchPriority="high" unoptimized={isRemoteMedia(sectionImage)} sizes="(max-width: 1024px) 100vw, 56vw" className="object-cover" />{heroMedia?.caption && <p className="absolute left-5 top-5 max-w-[80%] rounded-full bg-white/92 px-4 py-2 text-xs font-medium shadow-sm backdrop-blur-sm sm:left-7 sm:top-7">{heroMedia.caption}</p>}</div>
          <div className="relative -mt-4 overflow-hidden rounded-t-[1.75rem] bg-white px-6 pb-6 pt-7 sm:-mt-12 sm:rounded-t-[2.75rem] sm:px-10 sm:pb-10 sm:pt-11 lg:-mt-9 lg:pb-9 lg:pt-10">
            <div className="relative">
              <p className="text-[.6rem] font-bold uppercase leading-snug tracking-[.14em] text-[var(--accent)] sm:text-[.7rem] sm:tracking-[.18em]">{eyebrow || campaign.offerType} · Spišská Nová Ves</p>
              <h1 className="mt-3 max-w-2xl text-[2.15rem] font-bold leading-[.97] tracking-[-.05em] sm:mt-4 sm:text-5xl lg:text-[3.55rem]">{sectionHeadline}</h1>
              <p className="mt-3.5 max-w-2xl text-base leading-[1.55] text-[#686b68] sm:mt-5 sm:text-lg sm:leading-[1.65] lg:mt-4">{sectionCopy}</p>
              <div className="mt-5 flex items-center gap-1.5 sm:mt-7 sm:gap-4 lg:mt-6"><BikeCta href={primaryHref} label={sectionCta} /><a href={telHref(campaign.phone)} data-track="phone" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-1.5 text-xs font-semibold transition hover:bg-[#f2f6f3] hover:text-[var(--accent)] sm:min-h-11 sm:gap-2 sm:px-3 sm:text-sm"><Phone size={16} className="shrink-0 text-[var(--accent)]" /> Zavolať</a></div>
            </div>
          </div>
        </article>
        <aside className="flex min-h-0 self-start flex-col rounded-[2rem] bg-white p-6 shadow-[0_18px_55px_rgba(28,38,31,.055)] ring-1 ring-black/[.025] sm:rounded-[2.75rem] sm:p-9 lg:p-8">
          <div className="flex items-start justify-between">
            <Image src="/brand/sambike-mark.png" alt="" width={240} height={220} className="h-auto w-14" />
            {showServiceParts ? <ServiceIllustration name="service-tools" className="-mr-1 -mt-2 h-14 w-16 sm:-mr-3 sm:-mt-5 sm:h-28 sm:w-32" /> : <span className="size-2.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />}
          </div>
          <div className="mx-auto my-8 max-w-sm text-center lg:my-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">Detail kampane</p><h2 className="mt-3 text-3xl font-bold tracking-[-.04em]">Všetko podstatné na jednom mieste.</h2></div><dl className="space-y-3">{detailRows.map(([label, value]) => <div key={label} className="rounded-[1.15rem] bg-[#f4f5f2] px-5 py-4"><dt className="text-xs font-medium text-[#7a7e79]">{label}</dt><dd className="mt-1 text-sm font-semibold leading-relaxed">{value}</dd></div>)}</dl>{processSteps.length > 0 && <ol className="mt-6 space-y-4">{processSteps.slice(0, 3).map((step, index) => <li key={step.title} className="flex gap-3 text-sm"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e9f3fc] text-xs font-bold text-[var(--accent)]">{index + 1}</span><span><strong className="block">{step.title}</strong><span className="mt-0.5 block text-[#747774]">{step.text}</span></span></li>)}</ol>}
          <BikeCta href={primaryHref} label={sectionCta} className="mt-7 self-center" />
        </aside>
      </section>;
    }

    if (section.type === "BENEFITS") {
      const items = textItems(content.items);
      const shown = items.length ? items : displayedBenefits;
      return <>
        <section className="mx-auto max-w-[82rem] px-5 pb-16 sm:px-8 lg:pb-24">
          <div className="grid gap-8 py-10 lg:grid-cols-[.72fr_1.28fr] lg:gap-20 lg:py-14">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow || "Prečo Sambike"}</p>
              <h2 className="mt-4 whitespace-pre-line text-4xl font-bold leading-[1.02] tracking-[-.045em]">{heading || "Jemný prístup. Poctivý servis."}</h2>
              {sectionDescription && <p className="mt-5 max-w-md leading-relaxed text-[#70736f]">{sectionDescription}</p>}
            </div>
            <ul className="relative grid gap-7 before:absolute before:bottom-7 before:left-[1.625rem] before:top-7 before:w-px before:bg-gradient-to-b before:from-[#7ebcf0] before:via-[#c7e1f7] before:to-transparent sm:grid-cols-3 sm:gap-8 sm:before:hidden">
              {shown.slice(0, 8).map((item, index) => {
                const Icon = [Clock3, Wrench, ShieldCheck][index % 3];
                return (
                  <li key={`${item.title}-${index}`} className="relative grid grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-4 sm:block">
                    <span className="relative z-10 inline-flex h-[3.25rem] w-[3.25rem] min-w-[3.25rem] max-w-[3.25rem] shrink-0 justify-self-start items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_8px_22px_rgba(28,38,31,.07)] ring-1 ring-black/[.045]">
                      {showServiceParts ? <ServiceBenefitIllustration name={serviceBenefitIllustrations[index % serviceBenefitIllustrations.length]} size={36} className="shrink-0" /> : <Icon size={21} strokeWidth={1.8} className="shrink-0 text-[var(--accent)]" />}
                    </span>
                    <div className="pt-0.5 sm:mt-4 sm:pt-0">
                      <h3 className="font-bold">{item.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-[#70736f]">{item.text}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
        {campaign.trustText && <aside className="mx-auto mb-16 max-w-[82rem] px-5 text-center text-sm font-semibold text-[#5f625f] sm:px-8" aria-label="Dôveryhodnostná informácia">{campaign.trustText}</aside>}
      </>;
    }

    if (section.type === "OFFER") {
      const image = sectionContentString(content, "imageUrl", offerImage);
      const label = sectionContentString(content, "ctaLabel", ctaText);
      return <section className="mx-auto grid max-w-[82rem] gap-5 px-4 pb-16 sm:px-8 lg:grid-cols-2 lg:gap-7 lg:pb-24"><figure className="overflow-hidden rounded-[2rem] bg-white sm:rounded-[2.75rem]"><div className="relative aspect-[4/3] bg-[#e2e4e0]"><Image src={image} alt={offerMedia?.caption || heading || campaign.name} fill quality={90} unoptimized={isRemoteMedia(image)} sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" /></div>{offerMedia?.caption && <figcaption className="px-6 py-5 text-sm text-[#6f726f] sm:px-8">{offerMedia.caption}</figcaption>}</figure><div className="relative flex flex-col justify-center overflow-hidden rounded-[2rem] bg-white px-6 py-10 sm:rounded-[2.75rem] sm:px-10 lg:px-12">{showServiceParts && <ServiceIllustration name="chain" className="pointer-events-none absolute -right-16 -top-8 h-44 w-56 opacity-[0.055]" />}<div className="relative"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow || "Aktuálna ponuka"}</p><h2 className="mt-4 text-4xl font-bold leading-[1.02] tracking-[-.045em] sm:text-5xl">{heading || campaign.name}</h2><p className="mt-5 text-lg leading-relaxed text-[#6f726f]">{sectionDescription || description}</p><div className="mt-8 rounded-[1.15rem] bg-[#f4f5f2] px-5 py-4"><span className="block text-xs text-[#7a7e79]">Cena a podmienky</span><strong className="mt-1 block text-xl">{sectionContentString(content, "priceText", campaign.priceText)}</strong></div><a href={primaryHref} data-track="cta" className="mt-7 inline-flex items-center gap-2 self-start text-sm font-bold text-[var(--accent)]">{label}<ArrowRight size={16} /></a></div></div></section>;
    }

    if (section.type === "FORM") return <section id="mam-zaujem" data-lead-form-section className="mx-auto max-w-[82rem] scroll-mt-6 px-4 pb-16 sm:px-8 lg:pb-24"><div className="grid gap-12 rounded-[2rem] bg-white px-6 py-10 sm:rounded-[2.75rem] sm:px-10 lg:grid-cols-[.72fr_1.28fr] lg:gap-20 lg:px-12 lg:py-14"><div className="relative overflow-hidden">{showServiceParts && <ServiceIllustration name="chain-lube" className="pointer-events-none absolute -bottom-2 -right-2 h-20 w-20 opacity-[0.06] sm:-bottom-5 sm:-right-5 sm:h-40 sm:w-36 sm:opacity-[0.07]" />}<div className="relative"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow || "Nezáväzná požiadavka"}</p><h2 className="mt-4 text-4xl font-bold leading-[1.02] tracking-[-.045em] sm:text-5xl">{heading || "Dohodnime si podrobnosti."}</h2><p className="mt-5 max-w-sm leading-relaxed text-[#6f726f]">{sectionDescription || campaign.responseTimeText || "Stačí meno a telefón. Ozveme sa a spolu dohodneme termín aj rozsah."}</p><div className="mt-8 space-y-3 text-sm"><a href={telHref(campaign.phone)} data-track="phone" className="flex items-center gap-3 hover:text-[var(--accent)]"><Phone size={17} className="text-[var(--accent)]" />{campaign.phone}</a><a href={`mailto:${campaign.email}`} className="flex items-center gap-3 hover:text-[var(--accent)]"><Mail size={17} className="text-[var(--accent)]" />{campaign.email}</a><a href={instagramProfileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-[var(--accent)]"><AtSign size={17} className="text-[var(--accent)]" />@sambike_snv</a>{campaign.address && (campaign.mapUrl ? <a href={campaign.mapUrl} target="_blank" rel="noreferrer" className="flex items-start gap-3 text-[#6f726f] hover:text-[var(--accent)]"><MapPin size={17} className="mt-0.5 shrink-0 text-[var(--accent)]" />{campaign.address}</a> : <p className="flex items-start gap-3 text-[#6f726f]"><MapPin size={17} className="mt-0.5 shrink-0 text-[var(--accent)]" />{campaign.address}</p>)}{campaign.openingHours && <p className="flex items-start gap-3 text-[#6f726f]"><Clock3 size={17} className="mt-0.5 shrink-0 text-[var(--accent)]" />{campaign.openingHours}</p>}</div></div></div>{preview ? <div className="self-center border-y border-[#d9dcd7] py-10 text-center" role="status"><p className="font-semibold">Formulár je v náhľade bezpečne vypnutý.</p><p className="mt-2 text-sm text-[#6f726f]">Náhľad nevytvorí lead ani neodošle e-mail.</p></div> : <LeadForm campaignId={campaign.id} campaignSlug={campaign.slug} offerType={campaign.offerType} formToken={formToken} turnstileSiteKey={turnstileSiteKey} variant={variant} />}</div></section>;

    if (section.type === "GALLERY") {
      const media = galleryMedia;
      return <>
        {(beforeMedia || afterMedia) && (
          <section className="mx-auto max-w-[82rem] px-4 pb-16 sm:px-8 lg:pb-24">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">Pred a po</p>
            <h2 className="mt-4 text-4xl font-bold tracking-[-.045em] sm:text-5xl">Rozdiel, ktorý je vidieť.</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {([[beforeMedia, "Pred servisom"], [afterMedia, "Po servise"]] as const).flatMap(([item, label]) => item ? [
                <figure key={item.id} className="overflow-hidden rounded-[2rem] bg-white">
                  <div className="relative aspect-[4/3] bg-[#dfe2dd]">
                    <Image src={item.mediaUrl} alt={item.caption || label} fill quality={90} unoptimized={isRemoteMedia(item.mediaUrl)} sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
                  </div>
                  <figcaption className="px-6 py-5 text-sm font-semibold">{label}{item.caption ? ` · ${item.caption}` : ""}</figcaption>
                </figure>,
              ] : [])}
            </div>
          </section>
        )}
        {media.length > 0 && (
          <section className="mx-auto max-w-[82rem] px-4 pb-16 sm:px-8 lg:pb-24">
            <div className="mb-9 sm:flex sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow || "Práca zo servisu"}</p>
                <h2 className="mt-4 text-4xl font-bold tracking-[-.045em] sm:text-5xl">{heading || "Detail, ktorý je vidieť."}</h2>
              </div>
              {sectionDescription && <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#70736f] sm:mt-0">{sectionDescription}</p>}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {media.map((item, index) => {
                const label = item.caption || `${campaign.name} – ${item.mediaType === "VIDEO" ? "video" : "fotografia"} ${index + 1}`;
                const isLastOddItem = media.length % 2 === 1 && index === media.length - 1;
                return (
                  <figure key={item.id} className={`overflow-hidden rounded-[2rem] bg-white sm:rounded-[2.5rem] ${isLastOddItem ? "sm:col-span-2" : ""}`}>
                    <div className={`relative bg-[#dfe2dd] ${isLastOddItem ? "aspect-[4/3] sm:aspect-[21/9]" : "aspect-[4/3]"}`}>
                      {item.mediaType === "VIDEO"
                        ? <video src={item.mediaUrl} aria-label={label} controls muted playsInline preload="metadata" className="size-full object-cover" />
                        : <Image src={item.mediaUrl} alt={label} fill quality={90} unoptimized={isRemoteMedia(item.mediaUrl)} sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />}
                    </div>
                    <figcaption className="flex items-center gap-3 px-6 py-5 text-sm text-[#666a66]"><span className="flex size-6 items-center justify-center rounded-full bg-[#e9f3fc] text-[var(--accent)]"><Check size={13} strokeWidth={2.4} /></span>{item.caption || `${item.mediaType === "VIDEO" ? "Video" : "Zo servisu"} · ${String(index + 1).padStart(2, "0")}`}</figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        )}
      </>;
    }

    if (section.type === "FAQ") {
      const items = faqItems(content.items);
      const shown = items.length ? items : displayedFaq;
      return <section className="mx-auto grid max-w-[82rem] gap-10 px-4 pb-16 sm:px-8 lg:grid-cols-[.65fr_1.35fr] lg:gap-20 lg:pb-24"><div className="relative overflow-hidden">{showServiceParts && <ServiceIllustration name="helmet" className="pointer-events-none absolute -bottom-7 right-0 hidden h-36 w-44 opacity-[0.07] lg:block" />}<div className="relative"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow || "Praktické informácie"}</p><h2 className="mt-4 text-4xl font-bold tracking-[-.045em] sm:text-5xl">{heading || "Časté otázky."}</h2>{sectionDescription && <p className="mt-5 max-w-md leading-relaxed text-[#70736f]">{sectionDescription}</p>}</div></div><div className="overflow-hidden rounded-[2rem] bg-white px-6 sm:rounded-[2.5rem] sm:px-8">{shown.map((item, index) => <details key={`${item.question}-${index}`} className="group border-b border-[#e0e3de] py-1 last:border-0" open={index === 0}><summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 font-bold marker:content-none">{item.question}<span className="text-2xl font-normal text-[var(--accent)] transition group-open:rotate-45" aria-hidden="true">+</span></summary><p className="max-w-2xl pb-6 pr-10 leading-relaxed text-[#6f726f]">{item.answer}</p></details>)}</div></section>;
    }

    if (section.type === "TESTIMONIALS") {
      const items = testimonialItems(content.items);
      if (!items.length) return null;
      return <section className="mx-auto max-w-[82rem] px-4 pb-16 sm:px-8 lg:pb-24"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow || "Referencie zákazníkov"}</p>{heading && <h2 className="mt-4 text-4xl font-bold tracking-[-.045em] sm:text-5xl">{heading}</h2>}{sectionDescription && <p className="mt-5 max-w-2xl leading-relaxed text-[#70736f]">{sectionDescription}</p>}<ul className="mt-6 grid gap-5 md:grid-cols-2">{items.map((item, index) => <li key={`${item.name}-${index}`} className="rounded-[2rem] bg-white p-7 sm:p-9"><blockquote className="text-lg leading-relaxed text-[#5f625f]">„{item.text}“</blockquote><p className="mt-5 text-sm font-bold">{item.name}</p></li>)}</ul></section>;
    }

    if (section.type === "CTA") {
      const href = sectionContentString(content, "href", primaryHref);
      return <section data-final-cta className="mx-auto max-w-[82rem] px-4 pb-5 sm:px-8"><div className="flex flex-col items-start justify-between gap-8 rounded-[2rem] bg-[var(--accent)] px-6 py-10 text-white sm:rounded-[2.75rem] sm:px-10 lg:flex-row lg:items-center lg:px-12 lg:py-14"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-white/70">{eyebrow || "Dohodnite si termín"}</p><h2 className="mt-3 max-w-3xl text-4xl font-bold leading-[1.02] tracking-[-.045em] sm:text-5xl">{heading || campaign.finalCtaText || "Pošlite nám nezáväznú požiadavku."}</h2>{sectionDescription && <p className="mt-4 max-w-2xl text-white/80">{sectionDescription}</p>}</div><div className="flex shrink-0 flex-wrap items-center gap-5"><a href={href} data-track="cta" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-bold text-white">{sectionContentString(content, "ctaLabel", ctaText)}<ArrowRight size={17} /></a><a href={telHref(campaign.phone)} data-track="phone" className="inline-flex items-center gap-2 text-sm font-bold"><Phone size={17} /> Zavolať</a></div></div></section>;
    }

    if (section.type === "TEXT_IMAGE") {
      const image = sectionContentString(content, "imageUrl");
      return <section className="mx-auto grid max-w-[82rem] gap-8 px-4 pb-16 sm:px-8 lg:grid-cols-2 lg:items-center lg:pb-24">{image && <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-[#dfe2dd] sm:rounded-[2.75rem]"><Image src={image} alt={sectionContentString(content, "imageAlt", heading)} fill quality={90} unoptimized={isRemoteMedia(image)} sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" /></div>}<div className="px-2 py-4 lg:px-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow}</p><h2 className="mt-4 text-4xl font-bold tracking-[-.045em] sm:text-5xl">{heading}</h2><p className="mt-5 text-lg leading-relaxed text-[#6f726f]">{sectionDescription}</p></div></section>;
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

      <header className="mx-auto flex h-24 max-w-[82rem] items-center justify-between gap-4 px-5 sm:px-8 lg:sticky lg:top-0 lg:z-50 lg:bg-[#f3f4f1]/95 lg:backdrop-blur-sm">
        <Logo href={`/kampan/${campaign.slug}`} stacked />
        <div className="flex items-center gap-3 sm:gap-5">
          <a href={instagramProfileUrl} target="_blank" rel="noreferrer" className="hidden text-xs font-semibold tracking-[.08em] text-[#6e706e] transition hover:text-[var(--accent)] sm:inline">@sambike_snv</a>
          <a href={telHref(campaign.phone)} data-track="phone" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-white px-3 text-sm font-semibold shadow-[0_5px_18px_rgba(28,38,31,.06)] ring-1 ring-black/[.035] transition hover:-translate-y-0.5 hover:text-[var(--accent)] sm:bg-transparent sm:px-0 sm:shadow-none sm:ring-0">
            <Phone size={16} className="text-[var(--accent)]" />
            <span className="hidden sm:inline">{campaign.phone}</span><span className="sm:hidden">Zavolať</span>
          </a>
        </div>
      </header>
      {sections.map((section) => <div key={section.id} className="contents">{renderSection(section)}</div>)}

      <footer className="px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-[82rem] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Logo href={`/kampan/${campaign.slug}`} stacked />
          <div className="flex flex-col gap-1 text-xs text-[#747774] sm:text-right">{campaign.address && <span>{campaign.address}</span>}<span>© {new Date().getFullYear()} Sambike · servis bicyklov</span><Link href={campaign.legalUrl} className="underline underline-offset-2">Ochrana osobných údajov</Link>{!preview && <CampaignTracking campaignSlug={campaign.slug} pixelId={pixelId} variant={variant} />}</div>
        </div>
      </footer>

      <MobileStickyCta ctaText={ctaText} primaryHref={primaryHref} phone={campaign.phone} />
    </main>
  );
}
