import { BadgeCheck, Mail, Megaphone } from "lucide-react";
import { updateLeadNotificationRecipients } from "@/app/actions";
import { verifyMetaConnectionAction } from "@/app/meta-actions";
import { getNotificationRecipientSettings } from "@/lib/notification-recipients";
import { getMetaConnectionSummary } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; metaVerified?: string; metaError?: string }>;
}) {
  const [query, recipients] = await Promise.all([
    searchParams,
    getNotificationRecipientSettings(),
  ]);
  const activeCount = recipients.filter((recipient) => recipient.enabled).length;
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const meta = getMetaConnectionSummary();

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

        <dl className="mt-7 grid gap-x-8 gap-y-4 border-y border-[var(--line)] py-6 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-[#8a928c]">Stav</dt>
          <dd className="inline-flex items-center gap-2 font-medium">
            <span className={`size-2 rounded-full ${meta.configured ? "bg-[#7da33e]" : "bg-[#c0756e]"}`} />
            {meta.configured ? "Nastavené" : "Nedokončené"}
          </dd>
          <dt className="text-[#8a928c]">Reklamný účet</dt>
          <dd className="font-medium">{meta.adAccountId ? `act_${meta.adAccountId}` : "—"}</dd>
          <dt className="text-[#8a928c]">Facebook stránka</dt>
          <dd className="font-medium">{meta.pageId || "—"}</dd>
          <dt className="text-[#8a928c]">Instagram</dt>
          <dd className="font-medium">{meta.instagramConnected ? "Pripojený" : "Nie je pripojený"}</dd>
          <dt className="text-[#8a928c]">API verzia</dt>
          <dd className="font-medium">{meta.apiVersion}</dd>
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
      </section>
    </>
  );
}
