"use client";

import type { Campaign, CampaignGalleryItem } from "@/generated/prisma/client";
import { AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  CampaignGalleryField,
  type CampaignGalleryFieldHandle,
} from "@/components/campaign-gallery-field";
import { CampaignImageField } from "@/components/campaign-image-field";

type Props = {
  campaign?: Campaign & { galleryItems?: CampaignGalleryItem[] };
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
};

type CampaignField = {
  name: "name" | "slug" | "headline" | "priceText" | "ctaText" | "offerType" | "phone" | "email";
  label: string;
  placeholder: string;
  required: boolean;
  type?: "text" | "email";
  wide?: boolean;
};

const imageFields = [
  {
    label: "Úvodný obrázok",
    description: "Veľká fotografia na pozadí pri hlavnom nadpise.",
    fileName: "imageFile",
    urlName: "imageUrl",
    campaignKey: "imageUrl",
    fallbackUrl: undefined,
  },
  {
    label: "Obrázok pri ponuke",
    description: "Fotografia vedľa názvu, popisu a ceny kampane.",
    fileName: "offerImageFile",
    urlName: "offerImageUrl",
    campaignKey: "offerImageUrl",
    fallbackUrl: undefined,
  },
] as const;

const fields: CampaignField[] = [
  { name: "name", label: "Názov kampane", placeholder: "Požičovňa e-bikov", required: true },
  { name: "slug", label: "Adresa stránky", placeholder: "pozicovna", required: true },
  { name: "headline", label: "Hlavný nadpis", placeholder: "Objavte Slovenský raj na dvoch kolesách", required: true },
  { name: "priceText", label: "Cena alebo podmienky", placeholder: "od 29 € / deň", required: true },
  { name: "ctaText", label: "Text hlavného tlačidla", placeholder: "Rezervovať bicykel", required: true },
  { name: "offerType", label: "Typ ponuky", placeholder: "Požičovňa", required: true },
  { name: "phone", label: "Telefón", placeholder: "0948 035 117", required: true },
  { name: "email", label: "E-mail", placeholder: "ahoj@sambike.sk", required: true, type: "email" },
];

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

export function CampaignForm({ campaign, action, submitLabel }: Props) {
  const galleryRef = useRef<CampaignGalleryFieldHandle>(null);
  const uploadErrorRef = useRef<HTMLDivElement>(null);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (!uploadError) return;
    uploadErrorRef.current?.focus();
    uploadErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [uploadError]);

  async function submitCampaign(formData: FormData) {
    setUploadError("");
    try {
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
      console.error("Campaign submission failed:", error);
      setUploadError(
        "Kampaň sa neuložila, pretože server odmietol požiadavku. Vybrané súbory zostali vo formulári — skúste uloženie znova alebo skontrolujte nastavenie R2 úložiska.",
      );
    }
  }

  return (
    <form action={submitCampaign} className="mt-10 max-w-4xl">
      <div className="grid gap-x-12 gap-y-7 md:grid-cols-2">
        {fields.map((field) => (
          <label key={field.name} className={field.wide ? "md:col-span-2" : ""}>
            <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">{field.label}</span>
            <input
              className="admin-field"
              name={field.name}
              type={field.type ?? "text"}
              defaultValue={campaign?.[field.name] ?? ""}
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
            defaultValue={campaign?.description ?? ""}
            placeholder="Stručne opíšte ponuku a jej hlavné výhody."
            required
          />
        </label>
        <div className="md:col-span-2 mt-3 border-t border-[var(--line)] pt-7">
          <h2 className="text-lg font-semibold">Fotografie stránky</h2>
          <p className="mt-1 text-sm text-[#737c75]">Hlavné miesta nastavíte samostatne, ostatné fotografie a videá sa automaticky vyskladajú v galérii.</p>
        </div>
        {imageFields.map((field, index) => (
          <div key={field.urlName} className={`md:col-span-2 ${index > 0 ? "border-t border-[var(--line)] pt-7" : ""}`}>
            <CampaignImageField
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
      </div>

      <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4 border-t border-[var(--line)] pt-7">
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input className="size-4 accent-[#26372a]" type="checkbox" name="formEnabled" defaultChecked={campaign?.formEnabled ?? true} />
          Zobraziť formulár pre záujemcov
        </label>
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input className="size-4 accent-[#26372a]" type="checkbox" name="isActive" defaultChecked={campaign?.isActive ?? true} />
          Kampaň je aktívna
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
