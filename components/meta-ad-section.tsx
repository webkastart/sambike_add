import Image from "next/image";
import Link from "next/link";
import type { Campaign, MetaAdCampaign } from "@/generated/prisma/client";
import type { MetaConnectionSummary } from "@/lib/meta-ads";
import { MetaAdControls } from "@/components/meta-ad-controls";

type CampaignSummary = Pick<Campaign, "id" | "name" | "slug" | "headline" | "description" | "imageUrl" | "priceText">;

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
  createAction,
  startAction,
  pauseAction,
  syncAction,
  deleteAction,
  feedback,
}: {
  campaign: CampaignSummary;
  ad: MetaAdCampaign | null;
  leadCount: number;
  connection: MetaConnectionSummary;
  createAction: (formData: FormData) => Promise<void>;
  startAction: () => Promise<void>;
  pauseAction: () => Promise<void>;
  syncAction: () => Promise<void>;
  deleteAction: () => Promise<void>;
  feedback: { error?: string; message?: string };
}) {
  const effectiveStatus = ad?.effectiveStatus || ad?.status || "UNKNOWN";
  const active = ad?.status === "ACTIVE" && effectiveStatus === "ACTIVE";

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
          <span className="inline-flex items-center gap-2 text-xs font-medium text-[#61705f]">
            <span className="size-2 rounded-full bg-[#7da33e]" /> Meta účet je nastavený
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
      ) : ad?.metaCampaignId ? (
        <div className="mt-9">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <span className={`size-2 rounded-full ${active ? "bg-[#7da33e]" : effectiveStatus === "WITH_ISSUES" ? "bg-[#ba5a4f]" : "bg-[#aeb5af]"}`} />
              {statusLabels[effectiveStatus] ?? effectiveStatus}
            </span>
            <span className="text-xs text-[#8a928c]">Denný limit {money(ad.dailyBudgetCents)}</span>
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
          </div>
          {ad.lastError && <p className="mt-6 text-sm font-medium text-[#a1433e]">{ad.lastError}</p>}
          <p className="mt-6 text-xs text-[#929a94]">
            {ad.lastSyncedAt ? `Výsledky aktualizované ${dateTime(ad.lastSyncedAt)}` : "Výsledky ešte neboli synchronizované."}
          </p>
          <MetaAdControls
            active={active}
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
              <div className="relative"><input className="admin-field pr-8" name="dailyBudget" type="number" min="5" max="1000" step="1" defaultValue={ad ? ad.dailyBudgetCents / 100 : 10} required /><span className="absolute bottom-3 right-0 text-sm text-[#879088]">€</span></div>
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
          </div>

          <div className="mt-9 grid gap-5 border-y border-[var(--line)] py-6 sm:grid-cols-[8rem_1fr] sm:items-center">
            <div className="relative aspect-[4/3] overflow-hidden bg-[#edf0ec]">
              <Image src={campaign.imageUrl} alt="" fill sizes="128px" className="object-cover" />
            </div>
            <div>
              <p className="text-sm font-medium">Použije sa úvodný obrázok kampane</p>
              <p className="mt-1 text-xs leading-relaxed text-[#879088]">Cieľ: /kampan/{campaign.slug} · UTM parametre doplníme automaticky.</p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button type="submit" className="rounded-lg bg-[var(--accent-dark)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#314336]">
              {ad?.status === "ERROR" ? "Skúsiť vytvoriť znova" : "Vytvoriť pozastavenú reklamu"}
            </button>
            <span className="text-xs text-[#89918b]">Vytvorenie ešte nespustí čerpanie rozpočtu.</span>
          </div>
        </form>
      )}
    </section>
  );
}
