import { Mail } from "lucide-react";
import { updateLeadNotificationRecipients } from "@/app/actions";
import { getNotificationRecipientSettings } from "@/lib/notification-recipients";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ saved }, recipients] = await Promise.all([
    searchParams,
    getNotificationRecipientSettings(),
  ]);
  const activeCount = recipients.filter((recipient) => recipient.enabled).length;
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  return (
    <>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Administrácia</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Nastavenia</h1>
        <p className="mt-2 text-sm text-[#737c75]">Vyberte, komu majú chodiť upozornenia na nových záujemcov.</p>
      </header>

      {saved && <p className="mt-7 text-sm font-medium text-[#4e6a37]">Výber príjemcov bol uložený.</p>}

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
              className="mt-6 inline-flex min-h-10 items-center rounded-lg bg-[var(--accent-dark)] px-4 text-sm font-semibold text-white transition hover:bg-[#314336]"
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
    </>
  );
}
