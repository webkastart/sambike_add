import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleX, ExternalLink } from "lucide-react";
import { createTestLeadAction, retryFailedEmailsAction, sendTestEmailAction, updateNotificationRecipients, updateOperationalSettings } from "@/app/launch-actions";
import { emergencyPauseAllMetaAds, verifyMetaConnectionAction } from "@/app/meta-actions";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { campaignReadiness, createCampaignPreviewToken } from "@/lib/campaign-workflow";
import { cronHealthState, cronHealthIds } from "@/lib/cron-health";
import { canLaunchLive, launchCheck, summarizeLaunchChecks, type LaunchCheck, type LaunchState, type LaunchSummaryKey } from "@/lib/launch-readiness";
import { secretConfigurationStatuses } from "@/lib/launch-security";
import { getMetaConnectionSettings, metaBillingUrl } from "@/lib/meta-ads";
import { getNotificationRecipientSettings } from "@/lib/notification-recipients";
import { getOperationalSettings } from "@/lib/operational-settings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const stateLabels: Record<LaunchState, string> = { done: "Hotovo", attention: "Vyžaduje pozornosť", blocking: "Blokuje spustenie" };
const stateStyles: Record<LaunchState, string> = { done: "text-[#4e6a37]", attention: "text-[#9a6b25]", blocking: "text-[#a1433e]" };
const summaryLabels: Record<LaunchSummaryKey, string> = {
  publish: "Pripravené na publikovanie", leads: "Pripravené na zber leadov", email: "Pripravené na e-maily",
  measurement: "Pripravené na meranie", meta: "Pripravené na Meta reklamu", live: "Pripravené na live spustenie",
};

function StateIcon({ state }: { state: LaunchState }) {
  if (state === "done") return <CheckCircle2 size={17} aria-hidden="true" />;
  if (state === "attention") return <AlertTriangle size={17} aria-hidden="true" />;
  return <CircleX size={17} aria-hidden="true" />;
}

function CheckRows({ title, checks }: { title: string; checks: LaunchCheck[] }) {
  return <section className="border-t border-[var(--line)] py-10" aria-labelledby={`section-${title.replaceAll(" ", "-")}`}>
    <h2 id={`section-${title.replaceAll(" ", "-")}`} className="text-xl font-semibold">{title}</h2>
    <div className="mt-5 divide-y divide-[var(--line)] border-y border-[var(--line)]">
      {checks.map((check) => <div key={check.key} className="grid gap-3 py-4 sm:grid-cols-[11rem_1fr_auto] sm:items-start">
        <span className={`inline-flex items-center gap-2 text-xs font-semibold ${stateStyles[check.state]}`}><StateIcon state={check.state} />{stateLabels[check.state]}</span>
        <div><h3 className="text-sm font-semibold">{check.label}</h3><p className="mt-1 text-sm leading-6 text-[#737c75]">{check.explanation}</p><p className="mt-1 text-xs text-[#8a928c]">{check.verification === "automatic" ? "Automaticky overené" : check.verification === "manual" ? "Manuálna kontrola" : "Externá kontrola"}</p></div>
        <Link href={check.href} target={check.href.startsWith("http") ? "_blank" : undefined} rel={check.href.startsWith("http") ? "noreferrer" : undefined} className="text-sm font-semibold text-[#536057] hover:text-[var(--ink)]">{check.action} →</Link>
      </div>)}
    </div>
  </section>;
}

function envSet(name: string) { return Boolean(process.env[name]?.trim()); }
function displayDate(value: Date | null | undefined) { return value ? value.toLocaleString("sk-SK", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bratislava" }) : "Nikdy"; }
function feedbackMessage(query: { saved?: string; error?: string; count?: string; failed?: string }) {
  if (query.error) return query.error;
  if (query.saved === "test-email") return "Testovací e-mail bol úspešne odoslaný cez EmailOutbox.";
  if (query.saved === "retried") return `Retry sa spustil pre ${query.count || "0"} záznamov.`;
  if (query.saved === "meta-verified") return "Meta spojenie bolo úspešne overené pre aktuálny režim a účet.";
  if (query.saved === "emergency-paused") return `Núdzovo pozastavené: ${query.count || "0"}. Zlyhania: ${query.failed || "0"}.`;
  return "Nastavenia boli uložené.";
}

export default async function LaunchCenterPage({ searchParams }: { searchParams: Promise<{ campaign?: string; saved?: string; error?: string; section?: string; testLead?: string; count?: string; failed?: string }> }) {
  const query = await searchParams;
  const campaigns = await prisma.campaign.findMany({ orderBy: { updatedAt: "desc" }, include: { galleryItems: { orderBy: { sortOrder: "asc" } }, metaAd: true } });
  const campaign = campaigns.find((item) => item.id === query.campaign) ?? campaigns[0] ?? null;
  const [settings, recipients, meta, metaCheck, outboxCounts, cronRows, lastTestLead] = await Promise.all([
    getOperationalSettings(),
    getNotificationRecipientSettings(),
    getMetaConnectionSettings(),
    prisma.metaConnectionCheck.findUnique({ where: { id: "default" } }),
    prisma.emailOutbox.groupBy({ by: ["status"], where: { status: { in: ["PENDING", "FAILED"] } }, _count: { _all: true } }),
    prisma.cronHealth.findMany({ where: { id: { in: [...cronHealthIds] } } }),
    prisma.lead.findFirst({ where: { name: { startsWith: "TEST –" } }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, anonymizedAt: true } }),
  ]);
  const count = (status: string) => outboxCounts.find((row) => row.status === status)?._count._all ?? 0;
  const currentVerification = Boolean(metaCheck && metaCheck.mode === meta.mode && metaCheck.adAccountId === meta.adAccountId && new Date().getTime() - metaCheck.verifiedAt.getTime() < 24 * 60 * 60 * 1000);
  let campaignUrl = "";
  if (campaign) { try { campaignUrl = new URL(`/kampan/${campaign.slug}`, process.env.APP_URL || "http://localhost:3000").toString(); } catch { campaignUrl = `/kampan/${campaign.slug}`; } }
  let previewHref = campaign ? `/kampan/${campaign.slug}?preview=unavailable` : "#";
  if (campaign) { try { previewHref = `/kampan/${campaign.slug}?preview=${encodeURIComponent(createCampaignPreviewToken(campaign.id))}&variant=A`; } catch { /* status below explains missing secret */ } }
  const publication = campaign ? campaignReadiness(campaign, { appUrl: process.env.APP_URL, requireProductionUrl: process.env.NODE_ENV === "production" }) : null;
  const campaignHref = campaign ? `/admin/kampane/${campaign.id}` : "/admin/kampane/nova";

  const publishChecks: LaunchCheck[] = campaign && publication ? publication.items.map((item) => launchCheck({
    key: item.key, label: item.label, ready: item.ready, required: item.level === "required",
    explanation: item.ready ? "Kontrola prešla." : item.detail || "Doplňte alebo opravte údaje kampane pred publikovaním.",
    action: "Upraviť kampaň", href: campaignHref, verification: "automatic",
  })) : [launchCheck({ key: "campaign", label: "Kampaň", ready: false, required: true, explanation: "Najprv vytvorte kampaň.", action: "Vytvoriť kampaň", href: "/admin/kampane/nova", verification: "automatic" })];
  if (campaign) publishChecks.unshift(launchCheck({ key: "published", label: "Landing page je publikovaná", ready: campaign.status === "PUBLISHED", required: false, explanation: campaign.status === "PUBLISHED" ? `Verejná stránka je dostupná na ${campaignUrl}.` : "Pred reklamou musí byť landing page publikovaná.", action: "Otvoriť detail", href: campaignHref, verification: "automatic" }));

  const leadChecks: LaunchCheck[] = [
    launchCheck({ key: "gdpr", label: "Firma a GDPR údaje", ready: Boolean(settings.privacyOperatorName && settings.privacyOperatorAddress && settings.privacyContactEmail && settings.privacyPolicyVersion && settings.leadRetentionDays), required: true, explanation: "Verejná politika musí uvádzať prevádzkovateľa, kontakt, verziu a retenčnú lehotu.", action: "Upraviť GDPR", href: "#settings", verification: "automatic" }),
    launchCheck({ key: "turnstile", label: "Cloudflare Turnstile", ready: envSet("TURNSTILE_SECRET_KEY") && envSet("NEXT_PUBLIC_TURNSTILE_SITE_KEY"), required: process.env.NODE_ENV === "production", explanation: envSet("TURNSTILE_SECRET_KEY") ? "Serverový secret je nastavený; jeho hodnota sa nezobrazuje." : "Doplňte oba Turnstile kľúče v hostingu.", action: "Konfigurácia hostingu", href: "#infrastructure", verification: "automatic" }),
    launchCheck({ key: "form-protection", label: "Ochrana proti rýchlemu odoslaniu", ready: envSet("LEAD_PROTECTION_SECRET") || process.env.NODE_ENV !== "production", required: true, explanation: "Verejný formulár používa podpísaný časový token, honeypot a databázový rate limit.", action: "Pozrieť test", href: "#lead-test", verification: "automatic" }),
    launchCheck({ key: "test-lead", label: "Test leadu a outboxu", ready: Boolean(lastTestLead), required: false, explanation: lastTestLead ? `Posledný test ${displayDate(lastTestLead.createdAt)}${lastTestLead.anonymizedAt ? " · anonymizovaný" : " · čaká na anonymizáciu"}.` : "Vytvorte syntetický TEST lead a overte jeho outbox.", action: lastTestLead ? "Otvoriť test lead" : "Spustiť test", href: lastTestLead ? `/admin/leady/${lastTestLead.id}` : "#lead-test", verification: "automatic" }),
  ];
  const emailChecks: LaunchCheck[] = [
    launchCheck({ key: "resend", label: "Resend API a odosielateľ", ready: envSet("RESEND_API_KEY") && envSet("RESEND_FROM_EMAIL"), required: true, explanation: `${envSet("RESEND_API_KEY") ? "API kľúč je nastavený" : "API kľúč chýba"}; odosielateľ: ${process.env.RESEND_FROM_EMAIL?.trim() || "chýba"}. Doména musí mať v Resend stav Verified.`, action: "Overiť doménu", href: "https://resend.com/domains", verification: "external" }),
    launchCheck({ key: "recipients", label: "Príjemcovia upozornení", ready: recipients.some((item) => item.enabled), required: true, explanation: `${recipients.filter((item) => item.enabled).length} aktívnych príjemcov.`, action: "Upraviť", href: "#email-settings", verification: "automatic" }),
    launchCheck({ key: "outbox", label: "EmailOutbox", ready: count("FAILED") === 0, required: false, explanation: `${count("PENDING")} čaká · ${count("FAILED")} zlyhalo. Odosielanie ani testy neobchádzajú outbox.`, action: "Spravovať", href: "#email-test", verification: "automatic" }),
  ];
  const measurementChecks: LaunchCheck[] = [
    launchCheck({ key: "pixel-id", label: "Meta Pixel/Dataset ID", ready: Boolean(settings.metaPixelId), required: false, explanation: settings.metaPixelId ? `ID je zadané (${settings.metaPixelSource === "database" ? "admin" : "env fallback"}).` : "Zadajte verejný číselný identifikátor.", action: "Nastaviť", href: "#settings", verification: "automatic" }),
    launchCheck({ key: "pixel-enabled", label: "Pixel zapnutý", ready: settings.metaPixelEnabled, required: false, explanation: settings.metaPixelEnabled ? "Pixel je zapnutý a na každej návšteve čaká na marketingový súhlas." : "Pixel je vypnutý. Nie je prezentovaný ako overený.", action: "Nastaviť", href: "#settings", verification: "automatic" }),
    launchCheck({ key: "pixel-consent", label: "Súhlas a eventy", ready: settings.metaPixelEnabled, required: false, explanation: "PageView sa odošle až po súhlase. Lead až po úspešnom serverovom uložení a iba raz v danej relácii formulára.", action: "Test Events", href: settings.metaPixelId ? `https://business.facebook.com/events_manager2/list/pixel/${settings.metaPixelId}/test_events` : "#settings", verification: "manual" }),
  ];
  const metaChecks: LaunchCheck[] = [
    launchCheck({ key: "meta-token", label: "Meta access token", ready: envSet("META_ACCESS_TOKEN"), required: true, explanation: envSet("META_ACCESS_TOKEN") ? "Token je nastavený; jeho hodnota sa nezobrazuje." : "Token nastavte v hostingu.", action: "Meta nastavenia", href: "#meta-actions", verification: "automatic" }),
    launchCheck({ key: "meta-account", label: "Reklamný účet v EUR a aktívny", ready: currentVerification && metaCheck?.currency === "EUR" && metaCheck.accountStatus === 1, required: true, explanation: currentVerification ? `Účet ${metaCheck?.accountName || ""}: ${metaCheck?.currency || "mena neznáma"}, status ${metaCheck?.accountStatus ?? "neznámy"}.` : "Spustite nové overenie; platí 24 hodín pre aktuálny režim a účet.", action: "Overiť spojenie", href: "#meta-actions", verification: "automatic" }),
    launchCheck({ key: "meta-assets", label: "Facebook Page a oprávnenia", ready: currentVerification && Boolean(metaCheck?.pageAvailable && metaCheck.permissionsOk), required: true, explanation: "Vlastník Business Portfólia musí systémovému používateľovi priradiť účet, stránku a ads_management.", action: "Business Settings", href: "https://business.facebook.com/settings", verification: "automatic" }),
    launchCheck({ key: "instagram", label: "Instagram účet", ready: Boolean(metaCheck?.instagramAvailable), required: false, explanation: metaCheck?.instagramAvailable ? "Instagram účet odpovedal cez Meta API." : "Instagram je voliteľný; pre Instagram placement ho priraďte v Business Portfóliu.", action: "Business Settings", href: "https://business.facebook.com/settings", verification: currentVerification ? "automatic" : "external" }),
    launchCheck({ key: "dataset", label: "Pixel/Dataset priradený k účtu", ready: metaCheck?.datasetAssigned === true, required: false, explanation: metaCheck?.datasetAssigned == null ? "API kontrola nie je dostupná alebo chýba ID; overte priradenie v Events Manageri." : metaCheck.datasetAssigned ? "Meta API našlo ID pri reklamnom účte." : "Meta API nenašlo ID pri reklamnom účte.", action: "Events Manager", href: "https://business.facebook.com/events_manager2", verification: metaCheck?.datasetAssigned == null ? "external" : "automatic" }),
    launchCheck({ key: "billing", label: "Platobná metóda", ready: false, required: false, explanation: "Platobné údaje Sambike Ads nečíta ani neukladá. Overte ich priamo v Meta.", action: "Platby v Meta", href: metaBillingUrl(), verification: "external" }),
    launchCheck({ key: "spend-limit", label: "Spending limit", ready: metaCheck?.spendCapCents != null, required: false, explanation: metaCheck?.spendCapCents == null ? "Meta API limit neposkytlo; overte ho externe." : `Automaticky načítaný limit ${(metaCheck.spendCapCents / 100).toFixed(2)} ${metaCheck.currency || ""}.`, action: "Ads Manager", href: metaBillingUrl(), verification: metaCheck?.spendCapCents == null ? "external" : "automatic" }),
  ];
  const liveChecks: LaunchCheck[] = [
    launchCheck({ key: "live-mode", label: "Režim live", ready: meta.mode === "live", required: true, explanation: meta.mode === "live" ? "Server je vedome nastavený na live." : "Sandbox je bezpečný predvolený režim a nevytvára aktívne reklamy.", action: "Konfigurácia hostingu", href: "#infrastructure", verification: "automatic" }),
    launchCheck({ key: "published-live", label: "Publikovaná cieľová stránka", ready: campaign?.status === "PUBLISHED", required: true, explanation: campaign ? campaignUrl : "Vyberte kampaň.", action: "Detail kampane", href: campaignHref, verification: "automatic" }),
    launchCheck({ key: "budgets", label: "Bezpečné rozpočtové limity", ready: settings.maxCampaignDailyBudgetCents > 0 && settings.maxGlobalDailyBudgetCents >= settings.maxCampaignDailyBudgetCents, required: true, explanation: `${(settings.maxCampaignDailyBudgetCents / 100).toFixed(2)} € na kampaň · ${(settings.maxGlobalDailyBudgetCents / 100).toFixed(2)} € globálne denne. Server ich opäť kontroluje tesne pred aktiváciou.`, action: "Upraviť limity", href: "#settings", verification: "automatic" }),
    ...metaChecks.filter((item) => ["meta-token", "meta-account", "meta-assets"].includes(item.key)),
  ];
  const groups = { publish: publishChecks, leads: leadChecks, email: emailChecks, measurement: measurementChecks, meta: metaChecks, live: liveChecks };
  const summary = summarizeLaunchChecks(groups);

  const cronById = new Map(cronRows.map((row) => [row.id, row]));
  const secretStatuses = secretConfigurationStatuses(process.env);

  return <>
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Administrácia</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Centrum spustenia</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#737c75]">Jedno miesto pre publikovanie, leady, e-maily, meranie a bezpečné spustenie Meta reklamy.</p></div>{campaign && <div className="flex gap-4 text-sm font-semibold"><Link href={previewHref} target="_blank">Náhľad →</Link>{campaign.status === "PUBLISHED" && <a href={campaignUrl} target="_blank" rel="noreferrer">Verejná stránka →</a>}</div>}</header>

    {(query.saved || query.error) && <p role={query.error ? "alert" : "status"} className={`mt-7 border-l-2 pl-4 text-sm font-medium ${query.error ? "border-[#a1433e] text-[#a1433e]" : "border-[#6f8b49] text-[#4e6a37]"}`}>{feedbackMessage(query)}{query.testLead && <> <Link href={`/admin/leady/${query.testLead}`} className="underline">Otvoriť TEST lead</Link>.</>}</p>}

    <form className="mt-8 flex max-w-xl items-end gap-4" method="get"><label className="flex-1"><span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Kontrolovaná kampaň</span><select className="admin-field" name="campaign" defaultValue={campaign?.id}>{campaigns.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}</select></label><button className="pb-3 text-sm font-semibold" type="submit">Skontrolovať</button></form>

    <section className="mt-9 grid border-y border-[var(--line)] sm:grid-cols-2 lg:grid-cols-3" aria-label="Súhrnný stav">{(Object.keys(summary) as LaunchSummaryKey[]).map((key) => <div key={key} className="border-b border-[var(--line)] py-5 pr-6 lg:[&:nth-last-child(-n+3)]:border-b-0"><p className="text-xs text-[#737c75]">{summaryLabels[key]}</p><p className={`mt-2 inline-flex items-center gap-2 text-sm font-semibold ${stateStyles[summary[key]]}`}><StateIcon state={summary[key]} />{stateLabels[summary[key]]}</p></div>)}</section>

    <CheckRows title="Verejná stránka a obsah" checks={publishChecks} />

    <section id="settings" className="scroll-mt-8 border-t border-[var(--line)] py-10"><h2 className="text-xl font-semibold">Firma, GDPR, Pixel a rozpočty</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#737c75]">Tieto netajné hodnoty sa ukladajú v databáze a majú prednosť pred env fallbackom. Audit obsahuje iba názvy zmenených polí.</p><form action={updateOperationalSettings} className="mt-7 grid max-w-4xl gap-x-8 gap-y-6 sm:grid-cols-2">
      <label><span className="text-xs font-semibold uppercase tracking-[.1em]">Názov prevádzkovateľa</span><input className="admin-field" name="privacyOperatorName" defaultValue={settings.privacyOperatorName} required maxLength={200} /></label>
      <label><span className="text-xs font-semibold uppercase tracking-[.1em]">Kontaktný e-mail</span><input className="admin-field" type="email" name="privacyContactEmail" defaultValue={settings.privacyContactEmail} required /></label>
      <label className="sm:col-span-2"><span className="text-xs font-semibold uppercase tracking-[.1em]">Adresa</span><input className="admin-field" name="privacyOperatorAddress" defaultValue={settings.privacyOperatorAddress} required maxLength={300} /></label>
      <label><span className="text-xs font-semibold uppercase tracking-[.1em]">Verzia zásad</span><input className="admin-field" name="privacyPolicyVersion" defaultValue={settings.privacyPolicyVersion} required maxLength={50} /></label>
      <label><span className="text-xs font-semibold uppercase tracking-[.1em]">Retencia leadov · dni</span><input className="admin-field" type="number" name="leadRetentionDays" min={30} max={3650} defaultValue={settings.leadRetentionDays} required /></label>
      <label><span className="text-xs font-semibold uppercase tracking-[.1em]">Meta Pixel/Dataset ID</span><input className="admin-field" inputMode="numeric" pattern="[0-9]{5,30}" name="metaPixelId" defaultValue={settings.metaPixelId || ""} /></label>
      <label className="flex items-center gap-3 self-end pb-3"><input type="checkbox" name="metaPixelEnabled" defaultChecked={settings.metaPixelEnabled} className="size-4 accent-[#26372a]" /><span className="text-sm font-medium">Zapnúť Pixel po marketingovom súhlase</span></label>
      <label><span className="text-xs font-semibold uppercase tracking-[.1em]">Limit kampane · EUR/deň</span><input className="admin-field" type="number" name="maxCampaignDailyBudgetEuros" min={5} max={10000} defaultValue={settings.maxCampaignDailyBudgetCents / 100} required /></label>
      <label><span className="text-xs font-semibold uppercase tracking-[.1em]">Globálny limit · EUR/deň</span><input className="admin-field" type="number" name="maxGlobalDailyBudgetEuros" min={5} max={100000} defaultValue={settings.maxGlobalDailyBudgetCents / 100} required /></label>
      <div className="sm:col-span-2"><PendingSubmitButton pendingLabel="Ukladá sa…" className="rounded-[3px] bg-[var(--accent-dark)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Uložiť prevádzkové nastavenia</PendingSubmitButton></div>
    </form></section>

    <CheckRows title="Leady a ochrana formulára" checks={leadChecks} />
    <section id="lead-test" className="-mt-5 pb-10"><form action={createTestLeadAction} className="flex flex-wrap items-end gap-4"><input type="hidden" name="campaignId" value={campaign?.id || ""} /><PendingSubmitButton pendingLabel="Vytvára sa…" className="rounded-[3px] bg-[var(--accent-dark)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Vytvoriť TEST lead a outbox</PendingSubmitButton><span className="max-w-xl text-xs leading-5 text-[#8a928c]">Test je označený TEST, neobchádza verejný formulár a v detaile ho možno anonymizovať.</span></form></section>

    <CheckRows title="E-maily a Resend" checks={emailChecks} />
    <section id="email-settings" className="-mt-5 grid gap-8 pb-10 lg:grid-cols-2"><form action={updateNotificationRecipients}><label><span className="text-xs font-semibold uppercase tracking-[.1em]">Príjemcovia · jeden na riadok</span><textarea className="admin-field min-h-32" name="notificationEmails" defaultValue={recipients.map((item) => item.email).join("\n")} required /></label><PendingSubmitButton pendingLabel="Ukladá sa…" className="mt-4 text-sm font-semibold disabled:opacity-50">Uložiť príjemcov →</PendingSubmitButton></form><div id="email-test"><p className="text-sm text-[#737c75]">Odosielateľ: <strong className="text-[var(--ink)]">{process.env.RESEND_FROM_EMAIL?.trim() || "chýba"}</strong></p><div className="mt-5 flex flex-wrap gap-5"><form action={sendTestEmailAction}><input type="hidden" name="campaignId" value={campaign?.id || ""} /><PendingSubmitButton pendingLabel="Odosiela sa…" className="text-sm font-semibold disabled:opacity-50">Odoslať testovací e-mail →</PendingSubmitButton></form><form action={retryFailedEmailsAction}><PendingSubmitButton pendingLabel="Opakuje sa…" className="text-sm font-semibold text-[#7a4c30] disabled:opacity-50">Zopakovať failed e-maily →</PendingSubmitButton></form></div></div></section>

    <CheckRows title="Meta Pixel" checks={measurementChecks} />
    <section className="-mt-5 pb-10"><h3 className="text-sm font-semibold">Bezpečný test Pixelu</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-[#737c75]">V Meta Events Manageri otvorte Test Events, potom v novom okne otvorte verejnú stránku, povoľte marketingové cookies a odošlite testovací lead. Centrum samotné Pixel neoznačí ako overený iba podľa zadaného ID.</p><div className="mt-4 flex flex-wrap gap-5">{settings.metaPixelId && <a href={`https://business.facebook.com/events_manager2/list/pixel/${settings.metaPixelId}/test_events`} target="_blank" rel="noreferrer" className="text-sm font-semibold">Otvoriť Test Events →</a>}{campaign?.status === "PUBLISHED" && <a href={campaignUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold">Otvoriť verejnú stránku →</a>}</div></section>
    <CheckRows title="Meta Business a reklamný účet" checks={metaChecks} />
    <section id="meta-actions" className="-mt-5 flex flex-wrap items-center gap-6 pb-10"><form action={verifyMetaConnectionAction}><PendingSubmitButton pendingLabel="Overuje sa…" className="rounded-[3px] bg-[var(--accent-dark)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Overiť Meta spojenie</PendingSubmitButton></form><span className="text-xs text-[#8a928c]">Posledné úspešné overenie: {displayDate(metaCheck?.verifiedAt)}</span><a href="https://business.facebook.com/settings" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold">Priradiť aktíva <ExternalLink size={13} /></a></section>

    <section id="infrastructure" className="scroll-mt-8 border-t border-[var(--line)] py-10"><h2 className="text-xl font-semibold">Bezpečnosť a infraštruktúra</h2><p className="mt-2 text-sm text-[#737c75]">Zobrazuje sa iba stav. Tajné hodnoty sa neposielajú do HTML, databázy ani auditu.</p><div className="mt-6 grid gap-x-10 gap-y-3 sm:grid-cols-2">{secretStatuses.map(({ label, name, configured }) => <div key={name} className="flex items-center justify-between border-b border-[var(--line)] py-3 text-sm"><span>{label}</span><span className={`font-semibold ${configured ? "text-[#4e6a37]" : "text-[#a1433e]"}`}>{configured ? "Nastavené" : "Chýba · hosting"}</span></div>)}</div><div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{cronHealthIds.map((id) => { const row = cronById.get(id); const state = cronHealthState(row?.lastSuccessAt); return <div key={id}><p className="text-sm font-semibold">Cron · {id}</p><p className={`mt-1 text-xs ${state === "healthy" ? "text-[#4e6a37]" : state === "stale" ? "text-[#9a6b25]" : "text-[#a1433e]"}`}>{state === "healthy" ? "Posledný beh je aktuálny" : state === "stale" ? "Posledný beh je zastaraný" : "Úspešný beh zatiaľ neevidujeme"}</p><p className="mt-1 text-xs text-[#8a928c]">{displayDate(row?.lastSuccessAt)}</p></div>; })}<div><p className="text-sm font-semibold">R2 storage</p><p className="mt-1 text-xs text-[#737c75]">{process.env.CAMPAIGN_MEDIA_STORAGE === "r2" && envSet("R2_ACCOUNT_ID") && envSet("R2_BUCKET_NAME") && envSet("R2_ACCESS_KEY_ID") && envSet("R2_SECRET_ACCESS_KEY") ? "Pripravené" : "Vyžaduje konfiguráciu v hostingu"}</p></div><div><p className="text-sm font-semibold">Sentry</p><p className="mt-1 text-xs text-[#737c75]">{envSet("SENTRY_DSN") || envSet("NEXT_PUBLIC_SENTRY_DSN") ? "DSN nastavené" : "Vyžaduje konfiguráciu v hostingu"}</p></div></div></section>

    <CheckRows title="Rozpočty a bezpečné live spustenie" checks={liveChecks} />
    {campaign?.metaAd && <section className="-mt-5 border-y border-[var(--line)] py-7"><h3 className="font-semibold">Rekapitulácia reklamy</h3><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-[#8a928c]">Kampaň</dt><dd className="mt-1 font-medium">{campaign.name}</dd></div><div><dt className="text-[#8a928c]">Cieľová URL</dt><dd className="mt-1 break-all font-medium">{campaign.metaAd.destinationUrl}</dd></div><div><dt className="text-[#8a928c]">Platformy</dt><dd className="mt-1 font-medium">{campaign.metaAd.platforms}</dd></div><div><dt className="text-[#8a928c]">Publikum</dt><dd className="mt-1 font-medium">{campaign.metaAd.radiusKm} km · {campaign.metaAd.minAge}–{campaign.metaAd.maxAge === 65 ? "65+" : campaign.metaAd.maxAge}</dd></div><div><dt className="text-[#8a928c]">Denný rozpočet</dt><dd className="mt-1 font-medium">{(campaign.metaAd.dailyBudgetCents / 100).toFixed(2)} €</dd></div><div><dt className="text-[#8a928c]">Režim a termín</dt><dd className="mt-1 font-medium">{campaign.metaAd.mode} · {displayDate(campaign.metaAd.startsAt)} – {displayDate(campaign.metaAd.endsAt)}</dd></div></dl><p className={`mt-6 text-sm font-semibold ${canLaunchLive(liveChecks) ? "text-[#4e6a37]" : "text-[#a1433e]"}`}>{canLaunchLive(liveChecks) ? "Serverové povinné kontroly sú splnené. Samotné spustenie ešte vyžaduje explicitné potvrdenie v detaile kampane." : "Live spustenie je blokované. Opravte povinné body vyššie."}</p></section>}
    <div className="mt-8"><ConfirmActionButton action={emergencyPauseAllMetaAds} label="Núdzovo pozastaviť všetky Meta reklamy" confirmation="Núdzovo pozastaviť všetky aktívne Meta reklamy? Výsledok každej kampane sa audituje." /></div>
  </>;
}
