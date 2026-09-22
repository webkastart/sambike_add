/* eslint-disable @next/next/no-img-element -- campaign media can use arbitrary validated local or remote URLs */
import Link from "next/link";
import type { Campaign, MetaAdCampaign } from "@/generated/prisma/client";
import { metaAdsManagerUrl, metaBillingUrl, type MetaConnectionSummary } from "@/lib/meta-ads";
import { MetaAdControls } from "@/components/meta-ad-controls";
import type { CampaignMediaLibraryItem } from "@/lib/campaign-media-library-types";

type CampaignSummary = Pick<Campaign, "id" | "name" | "slug" | "headline" | "description" | "imageUrl" | "priceText" | "status">;

const statusLabels: Record<string, string> = {
  ACTIVE: "Aktívna",
  PAUSED: "Pozastavená",
  CREATING: "Vytvára sa",
  ERROR: "Vyžaduje pozornosť",
  IN_PROCESS: "Meta ju spracúva",
  WITH_ISSUES: "Meta hlási problém",
  CAMPAIGN_PAUSED: "Kampaň je pozastavená",
  UNKNOWN: "Neznámy stav",
};

function money(cents: number) {
  return (cents / 100).toLocaleString("sk-SK", { style: "currency", currency: "EUR" });
}

function dateTime(value: Date | null) {
  return value?.toLocaleString("sk-SK", { dateStyle: "medium", timeStyle: "short" }) ?? "—";
}

export function MetaAdSection({
  campaign,
  ad,
  leadCount,
  connection,
  creativeMedia,
  createAction,
  startAction,
  pauseAction,
  syncAction,
  deleteAction,
  budgetAction,
  feedback,
}: {
  campaign: CampaignSummary;
  ad: MetaAdCampaign | null;
  leadCount: number;
  connection: MetaConnectionSummary;
  creativeMedia: CampaignMediaLibraryItem[];
  createAction: (formData: FormData) => Promise<void>;
  startAction: (formData: FormData) => Promise<void>;
  pauseAction: () => Promise<void>;
  syncAction: () => Promise<void>;
  deleteAction: () => Promise<void>;
  budgetAction: (formData: FormData) => Promise<void>;
  feedback: { error?: string; message?: string };
}) {
  const effectiveStatus = ad?.effectiveStatus || ad?.status || "UNKNOWN";
  const active = ad?.status === "ACTIVE" && effectiveStatus === "ACTIVE";
  const availableCreativeMedia = creativeMedia.length ? creativeMedia : [{
    mediaUrl: campaign.imageUrl,
    mediaType: "IMAGE" as const,
    campaignIds: [campaign.id],
    campaignNames: [campaign.name],
    label: "Úvodný obrázok",
    lastUsedAt: "",
  }];
  const selectedCreativeUrl = ad?.creativeMediaUrl || campaign.imageUrl;
  const billingUrl = metaBillingUrl();

  return (
    <section className="mt-16 border-t border-[var(--line)] pt-10" aria-labelledby="meta-ad-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Facebook · Instagram</p>
          <h2 id="meta-ad-title" className="mt-2 text-2xl font-semibold tracking-[-.025em]">Platená reklama</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#737c75]">
            Reklama smeruje na túto stránku kampane. Pred prvým spustením sa vždy vytvorí pozastavená.
          </p>
        </div>
        {connection.configured && (
          <span className={`inline-flex items-center gap-2 text-xs font-bold uppercase ${connection.mode === "live" ? "text-[#a1433e]" : "text-[#4e6a37]"}`}>
            <span className={`size-2 rounded-full ${connection.mode === "live" ? "bg-[#a1433e]" : "bg-[#7da33e]"}`} /> {connection.mode} režim
          </span>
        )}
      </div>

      {feedback.error && <p className="mt-7 text-sm font-medium text-[#a1433e]">{feedback.error}</p>}
      {feedback.message && <p className="mt-7 text-sm font-medium text-[#4e6a37]">{feedback.message}</p>}

      {!connection.configured ? (
        <div className="mt-8 border-y border-[var(--line)] py-6">
          <p className="text-sm font-medium">Najprv dokončite prepojenie Meta účtu.</p>
          <p className="mt-2 text-sm text-[#7b857d]">Chýba: {connection.missing.join(", ")}</p>
          <Link href="/admin/nastavenia#meta" className="mt-4 inline-block text-sm font-semibold text-[#536057] hover:text-[var(--ink)]">
            Otvoriť nastavenia →
          </Link>
        </div>
      ) : ad && (ad.metaCampaignId || ad.mode === "sandbox") ? (
        <div className="mt-9">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <span className={`size-2 rounded-full ${active ? "bg-[#7da33e]" : effectiveStatus === "WITH_ISSUES" ? "bg-[#ba5a4f]" : "bg-[#aeb5af]"}`} />
              {statusLabels[effectiveStatus] ?? effectiveStatus}
            </span>
            <span className="text-xs text-[#8a928c]">Denný limit {money(ad.dailyBudgetCents)}</span>
            <span className="text-xs font-semibold uppercase text-[#8a928c]">{ad.mode}</span>
            <span className="text-xs text-[#8a928c]">{ad.platforms.split(",").map((value) => value === "facebook" ? "Facebook" : "Instagram").join(" + ")}</span>
          </div>

          <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-7 border-y border-[var(--line)] py-7 sm:grid-cols-5">
            <div><dt className="text-xs text-[#858e87]">Minuté</dt><dd className="mt-1 text-2xl font-semibold">{money(ad.spendCents)}</dd></div>
            <div><dt className="text-xs text-[#858e87]">Zobrazenia</dt><dd className="mt-1 text-2xl font-semibold">{ad.impressions.toLocaleString("sk-SK")}</dd></div>
            <div><dt className="text-xs text-[#858e87]">Kliknutia</dt><dd className="mt-1 text-2xl font-semibold">{ad.clicks.toLocaleString("sk-SK")}</dd></div>
            <div><dt className="text-xs text-[#858e87]">Meta leady</dt><dd className="mt-1 text-2xl font-semibold">{ad.metaLeads.toLocaleString("sk-SK")}</dd></div>
            <div><dt className="text-xs text-[#858e87]">Leady v adminovi</dt><dd className="mt-1 text-2xl font-semibold">{leadCount.toLocaleString("sk-SK")}</dd></div>
          </dl>

          <div className="mt-7 grid gap-x-10 gap-y-5 text-sm sm:grid-cols-2">
            <div><p className="text-xs text-[#8a928c]">Text reklamy</p><p className="mt-1 leading-relaxed">{ad.primaryText}</p></div>
            <div><p className="text-xs text-[#8a928c]">Nadpis</p><p className="mt-1 font-medium">{ad.adHeadline}</p></div>
            <div><p className="text-xs text-[#8a928c]">Publikum</p><p className="mt-1">{ad.radiusKm} km od Spišskej Novej Vsi · {ad.minAge}–{ad.maxAge === 65 ? "65+" : ad.maxAge} rokov</p></div>
            <div><p className="text-xs text-[#8a928c]">Termín</p><p className="mt-1">{dateTime(ad.startsAt)} – {dateTime(ad.endsAt)}</p></div>
            <div><p className="text-xs text-[#8a928c]">Kreatíva</p><p className="mt-1">{ad.creativeMediaType === "VIDEO" ? "MP4 video" : "Obrázok"}</p></div>
          </div>
          {ad.lastError && <p className="mt-6 text-sm font-medium text-[#a1433e]">{ad.lastError}</p>}
          {ad.previewFacebookUrl || ad.previewInstagramUrl ? <div className="mt-5 flex flex-wrap gap-5 text-sm font-semibold text-[var(--accent-dark)]">{ad.previewFacebookUrl && <a href={ad.previewFacebookUrl} target="_blank" rel="noreferrer">Facebook Meta preview →</a>}{ad.previewInstagramUrl && <a href={ad.previewInstagramUrl} target="_blank" rel="noreferrer">Instagram Meta preview →</a>}</div> : <p className="mt-5 text-sm text-[#737c75]">Meta preview nie je dostupné. Náhľad landing page nie je Meta preview.</p>}
          {ad.metaCampaignId && <a href={metaAdsManagerUrl(ad.metaCampaignId)} target="_blank" rel="noreferrer" className="ml-5 mt-5 inline-block text-sm font-semibold text-[#536057]">Otvoriť v Meta Ads Manageri →</a>}
          <p className="mt-6 text-xs text-[#929a94]">
            {ad.lastSyncedAt ? `Výsledky aktualizované ${dateTime(ad.lastSyncedAt)}` : "Výsledky ešte neboli synchronizované."}
          </p>
          <form action={budgetAction} className="mt-6 flex max-w-sm items-end gap-4"><label className="flex-1"><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Denný rozpočet v EUR</span><input className="admin-field" name="dailyBudget" type="number" min="5" max={connection.maxCampaignDailyBudgetCents / 100} defaultValue={ad.dailyBudgetCents / 100} required /></label><button type="submit" className="pb-3 text-sm font-semibold text-[var(--accent-dark)]">Uložiť</button></form>
          <div className="mt-7 flex flex-col gap-3 border-y border-[var(--line)] py-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-semibold">Platobná metóda</p><p className="mt-1 text-xs leading-5 text-[#7b857d]">Kartu bezpečne spravuje Meta. Sambike Ads nečíta ani neukladá číslo karty alebo CVC.</p></div>
            <a href={billingUrl} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-semibold text-[var(--accent-dark)]">Spravovať kartu v Meta →</a>
          </div>
          <MetaAdControls
            active={active}
            canActivate={connection.mode === "live" && ad.mode === "live" && campaign.status === "PUBLISHED"}
            hasRemote={Boolean(ad.metaCampaignId)}
            startAction={startAction}
            pauseAction={pauseAction}
            syncAction={syncAction}
            deleteAction={deleteAction}
          />
        </div>
      ) : (
        <form action={createAction} className="mt-9 max-w-4xl">
          {ad?.lastError && <p className="mb-7 text-sm font-medium text-[#a1433e]">Posledný pokus: {ad.lastError}</p>}
          <div className="grid gap-x-12 gap-y-7 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Hlavný text reklamy</span>
              <textarea className="admin-field" name="primaryText" defaultValue={ad?.primaryText || campaign.description} required />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Nadpis</span>
              <input className="admin-field" name="adHeadline" defaultValue={ad?.adHeadline || campaign.headline} required />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Krátky doplnok</span>
              <input className="admin-field" name="adDescription" defaultValue={ad?.adDescription || campaign.priceText} />
            </label>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Platformy</p>
              <div className="mt-3 flex flex-wrap gap-6">
                <label className="flex items-center gap-2.5 text-sm"><input className="size-4 accent-[#26372a]" type="checkbox" name="platform" value="facebook" defaultChecked={ad ? ad.platforms.includes("facebook") : true} /> Facebook</label>
                <label className={`flex items-center gap-2.5 text-sm ${connection.instagramConnected ? "" : "text-[#9aa29c]"}`}>
                  <input className="size-4 accent-[#26372a]" type="checkbox" name="platform" value="instagram" defaultChecked={ad ? ad.platforms.includes("instagram") : connection.instagramConnected} disabled={!connection.instagramConnected} /> Instagram
                </label>
              </div>
              {!connection.instagramConnected && <p className="mt-2 text-xs text-[#929a94]">Instagram sa sprístupní po doplnení jeho ID v nastaveniach.</p>}
            </div>
            <label>
              <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Denný rozpočet</span>
              <div className="relative"><input className="admin-field admin-field-with-trailing-unit" name="dailyBudget" type="number" min="5" max={connection.maxCampaignDailyBudgetCents / 100} step="1" defaultValue={ad ? ad.dailyBudgetCents / 100 : 10} required /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#879088]" aria-hidden="true">€</span></div><span className="mt-1 block text-xs text-[#8a928c]">Maximum {(connection.maxCampaignDailyBudgetCents / 100).toFixed(2)} €. Vyšší nezvyčajný rozpočet aplikácia odmietne.</span>
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Okruh od Spišskej Novej Vsi</span>
              <select className="admin-field" name="radiusKm" defaultValue={ad?.radiusKm ?? 30}>
                <option value="10">10 km</option><option value="20">20 km</option><option value="30">30 km</option><option value="50">50 km</option><option value="80">80 km</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-6">
              <label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Vek od</span><input className="admin-field" name="minAge" type="number" min="18" max="65" defaultValue={ad?.minAge ?? 18} required /></label>
              <label><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Vek do</span><input className="admin-field" name="maxAge" type="number" min="18" max="65" defaultValue={ad?.maxAge ?? 65} required /></label>
            </div>
            <label>
              <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Začiatok · voliteľné</span>
              <input className="admin-field" name="startsAt" type="datetime-local" />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Koniec · voliteľné</span>
              <input className="admin-field" name="endsAt" type="datetime-local" />
            </label>
            <div className="grid gap-3 border-y border-[var(--line)] py-5 md:col-span-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div><p className="text-sm font-semibold">Platobná metóda</p><p className="mt-1 text-xs leading-5 text-[#7b857d]">Kartu zadáte priamo v Meta pre tento reklamný účet. Sambike Ads nečíta ani neukladá číslo karty alebo CVC.</p></div>
              <a href={billingUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[var(--accent-dark)]">Pridať alebo skontrolovať kartu v Meta →</a>
            </div>
          </div>

          <fieldset className="mt-9 border-y border-[var(--line)] py-6">
            <legend className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Kreatíva reklamy</legend>
            <p className="mt-2 text-sm text-[#737c75]">Vyberte obrázok alebo MP4 video, ktoré už patrí ku kampani.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {availableCreativeMedia.map((item, index) => {
                const isHero = item.mediaUrl === campaign.imageUrl;
                const label = isHero ? "Úvodný obrázok" : item.label || `${item.mediaType === "VIDEO" ? "Video" : "Obrázok"} ${index + 1}`;
                return <label key={`${item.mediaType}:${item.mediaUrl}`} className="grid cursor-pointer grid-cols-[auto_7rem_1fr] items-center gap-3 border border-[var(--line)] p-3 transition hover:border-[#9ba89d] has-[:checked]:border-[var(--accent-dark)]">
                  <input type="radio" name="creativeMediaUrl" value={item.mediaUrl} defaultChecked={item.mediaUrl === selectedCreativeUrl} required className="size-4 accent-[#26372a]" />
                  <span className="relative block aspect-video overflow-hidden bg-[#edf0ec]">
                    {item.mediaType === "VIDEO"
                      ? <video src={item.mediaUrl} muted playsInline preload="metadata" className="size-full object-cover" />
                      : <img src={item.mediaUrl} alt="" className="size-full object-cover" />}
                  </span>
                  <span><strong className="block text-sm">{label}</strong><span className="mt-1 block text-xs text-[#879088]">{item.mediaType === "VIDEO" ? "MP4 video" : "Obrázok"}</span></span>
                </label>;
              })}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-[#879088]">Cieľ: /kampan/{campaign.slug} · UTM parametre doplníme automaticky. Meta vytvorí reklamu najprv ako pozastavenú.</p>
          </fieldset>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button type="submit" className="rounded-[3px] bg-[var(--accent-dark)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#075eac]">
              {ad?.status === "ERROR" ? "Skúsiť vytvoriť znova" : connection.mode === "sandbox" ? "Vytvoriť sandbox koncept" : "Vytvoriť pozastavenú reklamu"}
            </button>
            <span className="text-xs text-[#89918b]">Vytvorenie ešte nespustí čerpanie rozpočtu.</span>
          </div>
        </form>
      )}
    </section>
  );
}
