import { BadgeCheck, Mail, Megaphone } from "lucide-react";
import { updateLeadNotificationRecipients, updateMetaPixelSetting } from "@/app/actions";
import { emergencyPauseAllMetaAds, verifyMetaConnectionAction } from "@/app/meta-actions";
import { getMetaPixelSettings } from "@/lib/meta-pixel";
import { getNotificationRecipientSettings } from "@/lib/notification-recipients";
import { getMetaConnectionSummary, metaBillingUrl } from "@/lib/meta-ads";
import { prisma } from "@/lib/prisma";
import { ConfirmActionButton } from "@/components/confirm-action-button";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
    searchParams: Promise<{ saved?: string; pixelSaved?: string; pixelError?: string; metaVerified?: string; metaError?: string; emergencyPaused?: string; emergencyFailed?: string }>;
}) {
  const [query, recipients, metaPixel] = await Promise.all([
    searchParams,
    getNotificationRecipientSettings(),
    getMetaPixelSettings(),
  ]);
  const activeCount = recipients.filter((recipient) => recipient.enabled).length;
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const meta = getMetaConnectionSummary();
  const metaCheck = await prisma.metaConnectionCheck.findUnique({ where: { id: "default" } });
  const metaVerifiedForCurrentMode = metaCheck?.mode === meta.mode && metaCheck.adAccountId === meta.adAccountId;

  return (
    <>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Administrácia</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Nastavenia</h1>
        <p className="mt-2 text-sm text-[#737c75]">Vyberte, komu majú chodiť upozornenia na nových záujemcov.</p>
      </header>

      {query.saved && <p className="mt-7 text-sm font-medium text-[#4e6a37]">Výber príjemcov bol uložený.</p>}

      <section className="mt-11 max-w-2xl" aria-labelledby="notification-title">
        <div className="flex items-end justify-between gap-5">
          <div>
            <h2 id="notification-title" className="text-lg font-semibold">E-mailové upozornenia</h2>
            <p className="mt-1 text-sm text-[#7c857e]">
              Aktívni príjemcovia: {activeCount} z {recipients.length}
            </p>
          </div>
          <Mail size={18} className="text-[#8a928c]" aria-hidden="true" />
        </div>

        {recipients.length > 0 ? (
          <form action={updateLeadNotificationRecipients} className="mt-6">
            <div className="border-y border-[var(--line)]">
              {recipients.map((recipient, index) => (
                <label
                  key={recipient.email}
                  htmlFor={`notification-recipient-${index}`}
                  className="flex cursor-pointer items-center justify-between gap-5 border-b border-[var(--line)] py-4 last:border-b-0"
                >
                  <span className="sr-only">Posielať upozornenia na túto adresu</span>
                  <span>
                    <span className="block text-sm font-medium">{recipient.email}</span>
                    <span className="mt-1 block text-xs text-[#8a928c]">
                      {recipient.enabled ? "Dostáva nové leady" : "Upozornenia sú vypnuté"}
                    </span>
                  </span>
                  <input
                    id={`notification-recipient-${index}`}
                    type="checkbox"
                    name="recipient"
                    value={recipient.email}
                    defaultChecked={recipient.enabled}
                    className="size-4 shrink-0 accent-[#26372a]"
                  />
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="mt-6 inline-flex min-h-10 items-center rounded-[3px] bg-[var(--accent-dark)] px-4 text-sm font-semibold text-white transition hover:bg-[#075eac]"
            >
              Uložiť výber
            </button>
          </form>
        ) : (
          <p className="mt-6 border-y border-[var(--line)] py-5 text-sm text-[#737c75]">
            V hostingu najprv nastavte `LEAD_NOTIFICATION_EMAILS` so zoznamom adries oddelených čiarkou.
          </p>
        )}

        <dl className="mt-10 grid gap-2 text-sm sm:grid-cols-[9rem_1fr]">
          <dt className="text-[#8a928c]">Odosielateľ</dt>
          <dd className="break-all font-medium">{from || "Resend nie je nastavený"}</dd>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-[#8a928c]">
          Adresy sa pridávajú alebo odoberajú cez premennú `LEAD_NOTIFICATION_EMAILS` v hostingu.
          Tu iba určíte, ktoré z nich sú momentálne aktívne.
        </p>
      </section>

      <section id="meta" className="mt-16 max-w-2xl scroll-mt-8 border-t border-[var(--line)] pt-10" aria-labelledby="meta-title">
        <div className="flex items-end justify-between gap-5">
          <div>
            <h2 id="meta-title" className="text-lg font-semibold">Meta reklamy</h2>
            <p className="mt-1 text-sm text-[#7c857e]">Serverové prepojenie s Facebookom a Instagramom.</p>
          </div>
          <Megaphone size={18} className="text-[#8a928c]" aria-hidden="true" />
        </div>

        {query.metaVerified && (
          <p className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#4e6a37]">
            <BadgeCheck size={16} /> Meta účet aj Facebook stránka odpovedajú správne.
          </p>
        )}
        {query.metaError && <p className="mt-6 text-sm font-medium text-[#a1433e]">{query.metaError}</p>}
        {query.emergencyPaused && <p className={`mt-6 text-sm font-medium ${query.emergencyFailed === "0" ? "text-[#4e6a37]" : "text-[#a1433e]"}`}>Núdzovo pozastavené: {query.emergencyPaused}. Zlyhania: {query.emergencyFailed}. {query.emergencyFailed !== "0" && "Skontrolujte jednotlivé reklamy v Ads Manageri."}</p>}

        <div className="mt-8 border-y border-[var(--line)] py-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h3 className="font-semibold">Meta Pixel na landing pages</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#737c75]">
                Meria návštevy a úspešné odoslania formulára, aby Meta vedela priradiť výsledky k reklamám a lepšie ich optimalizovať. Pixel sa načíta až po výslovnom povolení marketingových cookies návštevníkom.
              </p>
            </div>
            <span className={`mt-1 size-2 shrink-0 rounded-full ${metaPixel.enabled ? "bg-[#7da33e]" : "bg-[#a7ada8]"}`} aria-hidden="true" />
          </div>

          {query.pixelSaved && <p className="mt-4 text-sm font-medium text-[#4e6a37]">Nastavenie Meta Pixelu bolo uložené.</p>}
          {query.pixelError && <p className="mt-4 text-sm font-medium text-[#a1433e]">Pixel nemožno zapnúť, kým v hostingu nie je platné číselné `NEXT_PUBLIC_META_PIXEL_ID`.</p>}

          <form action={updateMetaPixelSetting} className="mt-5">
            <div className={`flex items-center justify-between gap-5 ${metaPixel.configured ? "" : "opacity-60"}`}>
              <span>
                <label htmlFor="meta-pixel-enabled" className={`block text-sm font-medium ${metaPixel.configured ? "cursor-pointer" : "cursor-not-allowed"}`}>Zapnúť meranie cez Meta Pixel</label>
                <span id="meta-pixel-description" className="mt-1 block text-xs text-[#8a928c]">
                  {metaPixel.configured
                    ? metaPixel.enabled ? "Pixel je zapnutý a čaká na súhlas každého návštevníka." : "ID je nastavené, Pixel je momentálne vypnutý."
                    : "Najprv pridajte NEXT_PUBLIC_META_PIXEL_ID do produkčného prostredia a aplikáciu znovu nasaďte."}
                </span>
              </span>
              <input
                id="meta-pixel-enabled"
                type="checkbox"
                name="metaPixelEnabled"
                defaultChecked={metaPixel.enabled}
                disabled={!metaPixel.configured}
                aria-describedby="meta-pixel-description"
                className="size-4 shrink-0 accent-[#26372a]"
              />
            </div>
            <button
              type="submit"
              disabled={!metaPixel.configured}
              className="mt-5 inline-flex min-h-10 items-center rounded-[3px] bg-[var(--accent-dark)] px-4 text-sm font-semibold text-white transition hover:bg-[#075eac] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Uložiť nastavenie Pixelu
            </button>
          </form>

          <p className="mt-4 text-xs leading-relaxed text-[#8a928c]">
            Vypnutie zastaví meranie na landing pages, ale nepozastaví samotné Facebook ani Instagram reklamy. ID sa mení iba cez prostredie hostingu.
          </p>
        </div>

        <dl className="mt-8 grid gap-x-8 gap-y-4 border-y border-[var(--line)] py-6 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-[#8a928c]">Stav</dt>
          <dd className="inline-flex items-center gap-2 font-medium">
            <span className={`size-2 rounded-full ${meta.configured ? "bg-[#7da33e]" : "bg-[#c0756e]"}`} />
            {meta.configured ? "Nastavené" : "Nedokončené"}
          </dd>
          <dt className="text-[#8a928c]">Režim</dt>
          <dd className={`font-bold uppercase ${meta.mode === "live" ? "text-[#a1433e]" : "text-[#4e6a37]"}`}>{meta.mode}{!metaVerifiedForCurrentMode ? " · vyžaduje nové overenie" : " · overené"}</dd>
          <dt className="text-[#8a928c]">Reklamný účet</dt>
          <dd className="font-medium">{meta.adAccountId ? `act_${meta.adAccountId}` : "—"}</dd>
          <dt className="text-[#8a928c]">Facebook stránka</dt>
          <dd className="font-medium">{meta.pageId || "—"}</dd>
          <dt className="text-[#8a928c]">Instagram</dt>
          <dd className="font-medium">{meta.instagramConnected ? "Pripojený" : "Nie je pripojený"}</dd>
          <dt className="text-[#8a928c]">API verzia</dt>
          <dd className="font-medium">{meta.apiVersion}</dd>
          <dt className="text-[#8a928c]">Mena účtu</dt>
          <dd className="font-medium">{metaCheck?.currency || "Neoverené"}</dd>
          <dt className="text-[#8a928c]">Časové pásmo účtu</dt>
          <dd className="font-medium">{metaCheck?.timezoneName || "Neoverené"}</dd>
          <dt className="text-[#8a928c]">Stav účtu</dt>
          <dd className="font-medium">{metaCheck?.accountStatus == null ? "Neoverené" : metaCheck.accountStatus === 1 ? "Aktívny" : `Meta status ${metaCheck.accountStatus}`}</dd>
          <dt className="text-[#8a928c]">Spending limit</dt>
          <dd className="font-medium">{metaCheck?.spendCapCents == null ? "Overte v Meta Ads Manageri" : `${(metaCheck.spendCapCents / 100).toFixed(2)} ${metaCheck.currency || ""}`}</dd>
          <dt className="text-[#8a928c]">Amount spent</dt>
          <dd className="font-medium">{metaCheck?.amountSpentCents == null ? "Neoverené" : `${(metaCheck.amountSpentCents / 100).toFixed(2)} ${metaCheck.currency || ""}`}</dd>
          <dt className="text-[#8a928c]">Platobná metóda</dt>
          <dd className="font-medium">Overte v Meta Ads Manageri</dd>
          <dt className="text-[#8a928c]">Rozpočtové limity</dt>
          <dd className="font-medium">{(meta.maxCampaignDailyBudgetCents / 100).toFixed(2)} € / kampaň · {(meta.maxGlobalDailyBudgetCents / 100).toFixed(2)} € globálne denne</dd>
        </dl>

        {!meta.configured && (
          <p className="mt-5 text-sm leading-relaxed text-[#737c75]">
            V hostingu chýba: <code>{meta.missing.join(", ")}</code>. Token zostáva iba na serveri a v adminovi sa nikdy nezobrazuje.
          </p>
        )}
        {!meta.instagramConnected && (
          <p className="mt-3 text-sm leading-relaxed text-[#737c75]">
            Facebook reklamy môžu fungovať aj samostatne. Pre Instagram doplňte <code>META_INSTAGRAM_ACTOR_ID</code>.
          </p>
        )}
        {meta.configured && (
          <form action={verifyMetaConnectionAction} className="mt-6">
            <button type="submit" className="text-sm font-semibold text-[#536057] hover:text-[var(--ink)]">
              Overiť spojenie s Meta →
            </button>
          </form>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-5"><a href={metaBillingUrl()} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#536057]">Otvoriť platby a fakturáciu v Meta Ads Manageri →</a><ConfirmActionButton action={emergencyPauseAllMetaAds} label="Pozastaviť všetky Meta reklamy" confirmation="Núdzovo pozastaviť všetky aktívne Meta reklamy? Každá sa spracuje samostatne a výsledok sa audituje." /></div>
        <p className="mt-3 text-xs leading-relaxed text-[#8a928c]">Sambike Ads neukladá karty ani fakturačné údaje. Režim sa mení iba cez META_MODE v serverovom prostredí; live sa nikdy nezapne automaticky.</p>
      </section>
    </>
  );
}
