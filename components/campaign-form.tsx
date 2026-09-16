"use client";

import type { Campaign, CampaignGalleryItem } from "@/generated/prisma/client";
import { AlertCircle } from "lucide-react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  CampaignGalleryField,
  type CampaignGalleryFieldHandle,
} from "@/components/campaign-gallery-field";
import {
  CampaignImageField,
  type CampaignImageFieldHandle,
} from "@/components/campaign-image-field";

type Props = {
  campaign?: Campaign & { galleryItems?: CampaignGalleryItem[] };
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  template?: "service" | "rental" | "seasonal";
};

type CampaignField = {
  name: "name" | "slug" | "headline" | "priceText" | "ctaText" | "offerType" | "phone" | "email";
  label: string;
  placeholder: string;
  defaultValue?: string;
  required: boolean;
  type?: "text" | "email";
  wide?: boolean;
};

const imageFields = [
  {
    label: "Úvodný obrázok",
    description: "Veľká fotografia na pozadí pri hlavnom nadpise.",
    fileName: "imageFile",
    uploadedName: "imageUploadedMedia",
    urlName: "imageUrl",
    campaignKey: "imageUrl",
    fallbackUrl: "/sambike_store1.jpeg",
  },
  {
    label: "Obrázok pri ponuke",
    description: "Fotografia vedľa názvu, popisu a ceny kampane.",
    fileName: "offerImageFile",
    uploadedName: "offerImageUploadedMedia",
    urlName: "offerImageUrl",
    campaignKey: "offerImageUrl",
    fallbackUrl: "/sambike_image.jpeg",
  },
] as const;

const fields: CampaignField[] = [
  { name: "name", label: "Názov kampane", placeholder: "Servis bicyklov", defaultValue: "Servis bicyklov", required: true },
  { name: "slug", label: "Adresa stránky", placeholder: "napr. jarna-servisna-akcia", required: true },
  { name: "headline", label: "Hlavný nadpis", placeholder: "Servis bicyklov s osobným prístupom", defaultValue: "Servis bicyklov s osobným prístupom", required: true },
  { name: "priceText", label: "Cena alebo podmienky", placeholder: "Cena podľa rozsahu servisu", defaultValue: "Cena podľa rozsahu servisu", required: true },
  { name: "ctaText", label: "Text hlavného tlačidla", placeholder: "Objednať servis", defaultValue: "Objednať servis", required: true },
  { name: "offerType", label: "Typ ponuky", placeholder: "Servis bicyklov", defaultValue: "Servis bicyklov", required: true },
  { name: "phone", label: "Telefón", placeholder: "0948 035 117", defaultValue: "0948 035 117", required: true },
  { name: "email", label: "E-mail", placeholder: "sambike.snv@gmail.com", defaultValue: "sambike.snv@gmail.com", required: true, type: "email" },
];

const templateDefaults = {
  service: { name: "Servis bicyklov", headline: "Servis bicyklov s osobným prístupom", description: "Kvalitný servis v Spišskej Novej Vsi. Pošlite požiadavku a spolu dohodneme rozsah aj termín.", priceText: "Cena podľa rozsahu servisu", ctaText: "Objednať servis", offerType: "Servis bicyklov", benefits: "Jasný termín | Dostupný termín si spolu potvrdíme.\nOsobný prístup | Najprv si vypočujeme problém a navrhneme postup.\nSpoľahlivý výsledok | Bicykel skontrolujeme s dôrazom na bezpečnosť.", processSteps: "Pošlite požiadavku | Stačí meno, telefón a stručná poznámka.\nPotvrdíme rozsah | Zavoláme vám a dohodneme termín.\nPrevezmete bicykel | Vysvetlíme vykonanú prácu.", faq: "Ako si objednám servis? | Vyplňte krátky formulár alebo nám zavolajte.\nKedy budem poznať termín? | Termín vám potvrdíme telefonicky." },
  rental: { name: "Požičovňa e-bikov", headline: "Objavte okolie na e-biku", description: "Vyberte si termín a počet bicyklov. Dostupnosť vám potvrdíme telefonicky.", priceText: "Cena podľa typu bicykla a dĺžky prenájmu", ctaText: "Overiť dostupnosť", offerType: "Požičovňa e-bikov", benefits: "Overená dostupnosť | Termín vám potvrdíme pred návštevou.\nNastavenie bicykla | Pomôžeme s veľkosťou a nastavením.\nTipy na trasu | Odporučíme trasu podľa skúseností.", processSteps: "Vyberte termín | Napíšte dátum a počet osôb.\nPotvrdíme bicykle | Overíme veľkosti a dostupnosť.\nVyrazíte na trasu | Pri prevzatí vysvetlíme ovládanie.", faq: "Je rezervácia záväzná? | Podmienky potvrdíme telefonicky.\nČo si mám priniesť? | Podrobnosti oznámime pri potvrdení." },
  seasonal: { name: "Sezónna ponuka", headline: "Pripravte bicykel na sezónu", description: "Sezónna ponuka s jasnými podmienkami. Pošlite požiadavku a overíme dostupný termín.", priceText: "Doplňte cenu a presné podmienky", ctaText: "Chcem ponuku", offerType: "Sezónna ponuka", benefits: "Jasné podmienky | Pred publikovaním doplňte presný rozsah.\nJednoduchá rezervácia | Krátky formulár zaberie menej než minútu.\nLokálny servis | Všetko dohodnete priamo so Sambike.", processSteps: "Vyberte ponuku | Skontrolujte cenu a podmienky.\nPošlite kontakt | Uveďte telefón a termín.\nPotvrdíme objednávku | Ozveme sa s dostupnosťou.", faq: "Dokedy ponuka platí? | Doplňte dátum platnosti pred publikovaním.\nJe potrebná rezervácia? | Dostupnosť potvrdíme telefonicky." },
} as const;

function structuredText(value: unknown, first: string, second: string) {
  if (!Array.isArray(value)) return "";
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    return typeof record[first] === "string" && typeof record[second] === "string" ? [`${record[first]} | ${record[second]}`] : [];
  }).join("\n");
}

function CampaignSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-[3px] bg-[var(--accent-dark)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#075eac] disabled:cursor-wait disabled:opacity-60"
      type="submit"
      disabled={pending}
    >
      {pending ? "Nahrávam a ukladám…" : label}
    </button>
  );
}

export function CampaignForm({ campaign, action, submitLabel, template = "service" }: Props) {
  const router = useRouter();
  const galleryRef = useRef<CampaignGalleryFieldHandle>(null);
  const imageRefs = useRef<Record<string, CampaignImageFieldHandle | null>>({});
  const uploadErrorRef = useRef<HTMLDivElement>(null);
  const [uploadError, setUploadError] = useState("");
  const defaults = templateDefaults[template];

  useEffect(() => {
    if (!uploadError) return;
    uploadErrorRef.current?.focus();
    uploadErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [uploadError]);

  async function submitCampaign(formData: FormData) {
    setUploadError("");
    try {
      for (const field of imageFields) {
        const preparedImage = await imageRefs.current[field.fileName]?.prepareUpload();
        if (preparedImage?.direct) {
          formData.delete(field.fileName);
          if (preparedImage.item) {
            formData.set(field.uploadedName, JSON.stringify(preparedImage.item));
          }
        }
      }

      const prepared = await galleryRef.current?.prepareUploads();
      if (prepared?.direct) {
        formData.delete("galleryMediaFiles");
        for (const item of prepared.items) {
          formData.append("galleryUploadedMedia", JSON.stringify(item));
        }
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Nahrávanie súboru zlyhalo. Skúste to znova.");
      return;
    }

    try {
      await action(formData);
    } catch (error) {
      unstable_rethrow(error);
      console.error("Campaign submission failed:", error);
      setUploadError(
        "Kampaň sa neuložila, pretože server odmietol požiadavku. Vybrané súbory zostali vo formulári — skúste uloženie znova alebo skontrolujte nastavenie R2 úložiska.",
      );
    }
  }

  return (
    <form action={submitCampaign} className="mt-10 max-w-4xl">
      {!campaign && <label className="mb-9 block max-w-sm"><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Šablóna</span><select className="admin-field" value={template} onChange={(event) => router.push(`/admin/kampane/nova?sablona=${event.target.value}`)}><option value="service">Servis bicyklov</option><option value="rental">Požičovňa / e-bike</option><option value="seasonal">Sezónna ponuka</option></select><span className="mt-2 block text-xs text-[#89918b]">Šablóna iba predvyplní koncept. Pred publikovaním upravte skutočné údaje.</span></label>}
      <div className="grid gap-x-12 gap-y-7 md:grid-cols-2">
        {fields.map((field) => (
          <label key={field.name} className={field.wide ? "md:col-span-2" : ""}>
            <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">{field.label}</span>
            <input
              className="admin-field"
              name={field.name}
              type={field.type ?? "text"}
              defaultValue={campaign?.[field.name] ?? defaults[field.name as keyof typeof defaults] ?? field.defaultValue ?? ""}
              placeholder={field.placeholder}
              required={field.required}
            />
          </label>
        ))}
        <label className="md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Krátky popis</span>
          <textarea
            className="admin-field"
            name="description"
            defaultValue={campaign?.description ?? defaults.description}
            placeholder="Stručne opíšte ponuku a jej hlavné výhody."
            required
          />
        </label>
        <div className="md:col-span-2 mt-3 border-t border-[var(--line)] pt-7">
          <h2 className="text-lg font-semibold">Fotografie stránky</h2>
          <p className="mt-1 text-sm text-[#737c75]">Tieto dve fotografie slúžia ako základ. V médiách nižšie ich môžete nahradiť výberom sekcie „Úvod kampane“ alebo „Detail ponuky“.</p>
        </div>
        {imageFields.map((field, index) => (
          <div key={field.urlName} className={`md:col-span-2 ${index > 0 ? "border-t border-[var(--line)] pt-7" : ""}`}>
            <CampaignImageField
              ref={(handle) => { imageRefs.current[field.fileName] = handle; }}
              label={field.label}
              description={field.description}
              fileName={field.fileName}
              urlName={field.urlName}
              currentImageUrl={
                campaign?.[field.campaignKey]
                ?? (field.campaignKey === "offerImageUrl" ? campaign?.imageUrl : undefined)
                ?? field.fallbackUrl
              }
            />
          </div>
        ))}
        <div className="md:col-span-2 border-t border-[var(--line)] pt-7">
          <CampaignGalleryField ref={galleryRef} items={campaign?.galleryItems ?? []} />
        </div>
        <details className="md:col-span-2 border-t border-[var(--line)] pt-7" open={!campaign}>
          <summary className="cursor-pointer text-lg font-semibold">Obsah a dôveryhodnosť</summary>
          <p className="mt-2 text-sm text-[#737c75]">Jeden riadok na položku vo formáte „Nadpis | Text“. Prázdna voliteľná sekcia sa nezobrazí.</p>
          <div className="mt-6 grid gap-x-12 gap-y-7 md:grid-cols-2">
            <label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Benefity</span><textarea className="admin-field" name="benefits" defaultValue={campaign ? structuredText(campaign.benefits, "title", "text") : defaults.benefits} maxLength={3000} /></label>
            <label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Postup služby</span><textarea className="admin-field" name="processSteps" defaultValue={campaign ? structuredText(campaign.processSteps, "title", "text") : defaults.processSteps} maxLength={3000} /></label>
            <label className="md:col-span-2"><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">FAQ · Otázka | Odpoveď</span><textarea className="admin-field" name="faq" defaultValue={campaign ? structuredText(campaign.faq, "question", "answer") : defaults.faq} maxLength={6000} /></label>
            <label className="md:col-span-2"><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Skutočné referencie · Meno | Text</span><textarea className="admin-field" name="testimonials" defaultValue={campaign ? structuredText(campaign.testimonials, "name", "text") : ""} maxLength={5000} placeholder="Nevypĺňajte bez súhlasu a skutočnej referencie." /></label>
            <label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Očakávaný čas odpovede</span><input className="admin-field" name="responseTimeText" defaultValue={campaign?.responseTimeText ?? "Ozveme sa počas najbližšieho pracovného dňa."} maxLength={200} /></label>
            <label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Dôveryhodnostný text</span><input className="admin-field" name="trustText" defaultValue={campaign?.trustText ?? ""} maxLength={500} /></label>
            <label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Otváracie hodiny</span><input className="admin-field" name="openingHours" defaultValue={campaign?.openingHours ?? ""} maxLength={300} /></label>
            <label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Adresa</span><input className="admin-field" name="address" defaultValue={campaign?.address ?? "Letná 51, Spišská Nová Ves"} maxLength={300} /></label>
            <label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Mapový odkaz</span><input className="admin-field" name="mapUrl" type="url" defaultValue={campaign?.mapUrl ?? ""} maxLength={1000} /></label>
            <label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Finálne CTA</span><input className="admin-field" name="finalCtaText" defaultValue={campaign?.finalCtaText ?? "Pošlite nám nezáväznú požiadavku."} maxLength={180} /></label>
          </div>
        </details>
        <details className="md:col-span-2 border-t border-[var(--line)] pt-7">
          <summary className="cursor-pointer text-lg font-semibold">SEO a zdieľanie</summary>
          <div className="mt-6 grid gap-x-12 gap-y-7 md:grid-cols-2">
            <label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">SEO title *</span><input className="admin-field" name="seoTitle" defaultValue={campaign?.seoTitle ?? campaign?.headline ?? defaults.headline} maxLength={70} required /></label>
            <label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Canonical URL</span><input className="admin-field" name="canonicalUrl" type="url" defaultValue={campaign?.canonicalUrl ?? ""} maxLength={1000} /></label>
            <label className="md:col-span-2"><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Meta description *</span><textarea className="admin-field" name="seoDescription" defaultValue={campaign?.seoDescription ?? campaign?.description ?? defaults.description} maxLength={180} required /></label>
            <label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">OG title</span><input className="admin-field" name="ogTitle" defaultValue={campaign?.ogTitle ?? ""} maxLength={100} /></label>
            <label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">OG obrázok URL</span><input className="admin-field" name="ogImageUrl" defaultValue={campaign?.ogImageUrl ?? ""} maxLength={1000} /></label>
            <label className="md:col-span-2"><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">OG description</span><textarea className="admin-field" name="ogDescription" defaultValue={campaign?.ogDescription ?? ""} maxLength={300} /></label>
            <label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">GDPR odkaz *</span><input className="admin-field" name="legalUrl" defaultValue={campaign?.legalUrl ?? "/ochrana-osobnych-udajov"} maxLength={1000} required /></label>
            <label className="flex items-center gap-3 self-end pb-3 text-sm"><input className="size-4 accent-[#26372a]" type="checkbox" name="noIndex" defaultChecked={campaign?.noIndex ?? false} /> Zakázať indexovanie</label>
          </div>
        </details>
      </div>

      <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4 border-t border-[var(--line)] pt-7">
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input className="size-4 accent-[#26372a]" type="checkbox" name="formEnabled" defaultChecked={campaign?.formEnabled ?? true} />
          Zobraziť formulár pre záujemcov
        </label>
      </div>

      <div className="mt-10 flex items-center gap-4">
        <CampaignSubmitButton label={submitLabel} />
        <span className="text-xs text-[#89918b]">Diakritiku a medzery v adrese upravíme automaticky.</span>
      </div>
      {uploadError && (
        <div
          ref={uploadErrorRef}
          className="mt-4 flex max-w-3xl items-start gap-3 border-l-2 border-[#a1433e] bg-[#fff7f6] px-4 py-3 text-[#8f332f] outline-none"
          role="alert"
          tabIndex={-1}
        >
          <AlertCircle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Video alebo kampaň sa nepodarilo uložiť</p>
            <p className="mt-1 text-sm leading-relaxed">{uploadError}</p>
          </div>
        </div>
      )}
    </form>
  );
}
