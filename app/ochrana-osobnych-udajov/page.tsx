import type { Metadata } from "next";
import Link from "next/link";
import { leadRetentionDays, privacyPolicyVersion } from "@/lib/security-config";

export const metadata: Metadata = { title: "Ochrana osobných údajov" };

export default function PrivacyPage() {
  const operator = process.env.PRIVACY_OPERATOR_NAME?.trim();
  const address = process.env.PRIVACY_OPERATOR_ADDRESS?.trim();
  const email = process.env.PRIVACY_CONTACT_EMAIL?.trim();
  const configured = Boolean(operator && address && email);
  return (
    <main className="mx-auto max-w-3xl px-5 py-14 text-[var(--ink)] sm:px-8 sm:py-20">
      <Link href="/" className="text-sm text-[#6f6d6d] hover:underline">← Späť</Link>
      <h1 className="mt-8 text-4xl font-bold tracking-tight">Ochrana osobných údajov</h1>
      <p className="mt-3 text-sm text-[#6f6d6d]">Verzia zásad: {privacyPolicyVersion()}</p>
      {!configured && (
        <p className="mt-8 border-l-4 border-[#b36b2c] bg-[#fff7ed] p-4 text-sm">
          Údaje prevádzkovateľa ešte nie sú nakonfigurované. Pred produkčným nasadením je povinné nastaviť PRIVACY_OPERATOR_NAME, PRIVACY_OPERATOR_ADDRESS a PRIVACY_CONTACT_EMAIL.
        </p>
      )}
      <div className="mt-10 space-y-9 leading-7 text-[#4f5651]">
        <section><h2 className="text-xl font-semibold text-[var(--ink)]">Prevádzkovateľ</h2><p className="mt-2">{operator || "Údaj čaká na konfiguráciu"}<br />{address || "Adresa čaká na konfiguráciu"}<br />Kontakt: {email ? <a href={`mailto:${email}`} className="underline">{email}</a> : "e-mail čaká na konfiguráciu"}</p></section>
        <section><h2 className="text-xl font-semibold text-[var(--ink)]">Účel a právny základ</h2><p className="mt-2">Meno, telefón, voliteľný e-mail, poznámku a údaje o zdroji návštevy spracúvame na vybavenie vašej požiadavky a nadväzujúcu komunikáciu. Údaje odosielate so svojím súhlasom, ktorý môžete kedykoľvek odvolať kontaktovaním prevádzkovateľa.</p></section>
        <section><h2 className="text-xl font-semibold text-[var(--ink)]">Príjemcovia a uchovávanie</h2><p className="mt-2">Údaje môžu spracúvať poskytovatelia hostingu, databázy, e-mailovej služby, monitoringu a objektového úložiska iba v rozsahu potrebnom na prevádzku. Leady uchovávame najviac {leadRetentionDays()} dní, ak zákonná povinnosť nevyžaduje dlhšie uchovanie.</p></section>
        <section><h2 className="text-xl font-semibold text-[var(--ink)]">Vaše práva</h2><p className="mt-2">Môžete požiadať o prístup, opravu, vymazanie, obmedzenie spracúvania, prenosnosť alebo namietať spracúvanie. Máte tiež právo podať sťažnosť dozornému orgánu.</p></section>
        <section><h2 className="text-xl font-semibold text-[var(--ink)]">Interné meranie, cookies a marketing</h2><p className="mt-2">Pre prevádzkový prehľad ukladáme počty zobrazení stránky, kliknutí na výzvu, kliknutí na telefón a začatí formulára. Tieto udalosti neobsahujú surovú IP adresu, user-agent ani kontaktné údaje a neoznačujeme ich ako unikátnych ľudí. Odvodený hash sieťovej adresy slúži iba na časovo obmedzenú ochranu pred zahltením. Voľbu marketingových cookies uchovávame v nevyhnutnom preferenčnom cookie. Meta Pixel sa načíta až po udelení marketingového súhlasu. Odmietnutie neobmedzí formulár.</p></section>
      </div>
    </main>
  );
}
