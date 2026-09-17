import type { Campaign } from "@/generated/prisma/client";
import { CampaignMediaUrlField } from "@/components/campaign-media-url-field";
import type { CampaignMediaLibraryItem } from "@/lib/campaign-media-library-types";

type Props = { campaign: Campaign; action: (formData: FormData) => void | Promise<void>; mediaLibrary?: CampaignMediaLibraryItem[] };

const labelClass = "text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]";

export function CampaignSettingsForm({ campaign, action, mediaLibrary = [] }: Props) {
  return <details className="mt-12 border-y border-[var(--line)] py-7">
    <summary className="cursor-pointer text-lg font-semibold">Nastavenia kampane a SEO</summary>
    <p className="mt-2 text-sm text-[#737c75]">Kontaktné údaje, adresa stránky a údaje pre vyhľadávače.</p>
    <form action={action} className="mt-7 grid max-w-4xl gap-x-10 gap-y-6 sm:grid-cols-2">
      <label><span className={labelClass}>Interný názov kampane</span><input className="admin-field" name="name" defaultValue={campaign.name} maxLength={120} required /></label>
      <label><span className={labelClass}>Adresa stránky</span><input className="admin-field" name="slug" defaultValue={campaign.slug} maxLength={120} required /></label>
      <label><span className={labelClass}>Telefón</span><input className="admin-field" name="phone" defaultValue={campaign.phone} maxLength={30} required /></label>
      <label><span className={labelClass}>E-mail</span><input className="admin-field" type="email" name="email" defaultValue={campaign.email} maxLength={254} required /></label>
      <label><span className={labelClass}>Očakávaný čas odpovede</span><input className="admin-field" name="responseTimeText" defaultValue={campaign.responseTimeText ?? ""} maxLength={200} /></label>
      <label><span className={labelClass}>Dôveryhodnostný text</span><input className="admin-field" name="trustText" defaultValue={campaign.trustText ?? ""} maxLength={500} /></label>
      <label><span className={labelClass}>Otváracie hodiny</span><input className="admin-field" name="openingHours" defaultValue={campaign.openingHours ?? ""} maxLength={300} /></label>
      <label><span className={labelClass}>Adresa prevádzky</span><input className="admin-field" name="address" defaultValue={campaign.address ?? ""} maxLength={300} /></label>
      <label className="sm:col-span-2"><span className={labelClass}>Odkaz na mapu</span><input className="admin-field" type="url" name="mapUrl" defaultValue={campaign.mapUrl ?? ""} maxLength={1000} /></label>
      <div className="sm:col-span-2 mt-2 border-t border-[var(--line)] pt-6"><h3 className="font-semibold">SEO a zdieľanie</h3></div>
      <label><span className={labelClass}>Názov vo vyhľadávači</span><input className="admin-field" name="seoTitle" defaultValue={campaign.seoTitle ?? campaign.headline} maxLength={70} required /></label>
      <label><span className={labelClass}>Canonical URL</span><input className="admin-field" type="url" name="canonicalUrl" defaultValue={campaign.canonicalUrl ?? ""} maxLength={1000} /></label>
      <label className="sm:col-span-2"><span className={labelClass}>Popis vo vyhľadávači</span><textarea className="admin-field" name="seoDescription" defaultValue={campaign.seoDescription ?? campaign.description} maxLength={180} required /></label>
      <label><span className={labelClass}>Názov pri zdieľaní</span><input className="admin-field" name="ogTitle" defaultValue={campaign.ogTitle ?? ""} maxLength={100} /></label>
      <CampaignMediaUrlField label="Obrázok pri zdieľaní" name="ogImageUrl" defaultValue={campaign.ogImageUrl ?? ""} maxLength={1000} mediaLibrary={mediaLibrary} currentCampaignId={campaign.id} mediaTypes={["IMAGE"]} labelClassName={labelClass} />
      <label className="sm:col-span-2"><span className={labelClass}>Popis pri zdieľaní</span><textarea className="admin-field" name="ogDescription" defaultValue={campaign.ogDescription ?? ""} maxLength={300} /></label>
      <label><span className={labelClass}>Ochrana osobných údajov</span><input className="admin-field" name="legalUrl" defaultValue={campaign.legalUrl} maxLength={1000} required /></label>
      <label className="flex items-center gap-3 self-end pb-3 text-sm"><input className="size-4 accent-[#26372a]" type="checkbox" name="noIndex" defaultChecked={campaign.noIndex} /> Zakázať indexovanie</label>
      <div className="sm:col-span-2 border-t border-[var(--line)] pt-5"><button type="submit" className="rounded-[3px] bg-[var(--accent-dark)] px-5 py-2.5 text-sm font-semibold text-white">Uložiť nastavenia</button></div>
    </form>
  </details>;
}
