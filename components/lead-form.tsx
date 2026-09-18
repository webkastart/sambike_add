"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import Script from "next/script";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { createLead, type LeadFormState } from "@/app/actions";
import { readAttribution, trackEvent } from "@/lib/analytics";

const initialState: LeadFormState = { success: false, message: "" };
type Props = {
  campaignId: string;
  campaignSlug: string;
  offerType: string;
  formToken: string;
  turnstileSiteKey?: string;
  variant?: "A" | "B";
};

const attributionFields = ["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm", "landingPage", "referrer"] as const;

function applyAttribution(form: HTMLFormElement | null, campaignSlug: string) {
  if (!form) return;
  const attribution = readAttribution(campaignSlug);
  for (const field of attributionFields) {
    const input = form.elements.namedItem(field);
    if (input instanceof HTMLInputElement) input.value = attribution[field];
  }
}

export function LeadForm({ campaignId, campaignSlug, offerType, formToken, turnstileSiteKey, variant = "A" }: Props) {
  const [state, formAction, pending] = useActionState(createLead, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const startedRef = useRef(false);
  const leadTrackedRef = useRef(false);

  useEffect(() => {
    applyAttribution(formRef.current, campaignSlug);
  }, [campaignSlug]);

  useEffect(() => {
    if (!state.success) return;
    formRef.current?.reset();
    if (!leadTrackedRef.current) {
      trackEvent("Lead", { campaign_slug: campaignSlug, interest_type: offerType, variant, event_id: `lead:${formToken.split(".").at(-1) ?? campaignId}` });
      leadTrackedRef.current = true;
    }
  }, [campaignId, campaignSlug, formToken, offerType, state.success, variant]);

  if (state.success) {
    return (
      <div className="py-10 text-center" role="status">
        <CheckCircle2 className="mx-auto text-[var(--accent)]" size={38} strokeWidth={1.6} />
        <h3 className="mt-5 text-2xl font-semibold">Požiadavku sme prijali</h3>
        <p className="mx-auto mt-2 max-w-sm text-[#6f6d6d]">{state.message}</p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-x-8 gap-y-6 sm:grid-cols-2"
      onSubmitCapture={() => applyAttribution(formRef.current, campaignSlug)}
      onFocusCapture={() => {
        if (startedRef.current) return;
        startedRef.current = true;
        trackEvent("Form start", { campaign_slug: campaignSlug, variant });
      }}
    >
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="campaignSlug" value={campaignSlug} />
      <input type="hidden" name="interestType" value={offerType} />
      <input type="hidden" name="formToken" value={formToken} />
      <input type="hidden" name="variant" value={variant} />
      <input type="hidden" name="submissionId" value={formToken.split(".").at(-1) ?? ""} />
      <label className="absolute -left-[10000px]" aria-hidden="true">Web <input name="website" tabIndex={-1} autoComplete="off" /></label>
      {attributionFields.map((name) => <input key={name} type="hidden" name={name} defaultValue="" />)}

      <label>
        <span className="block text-xs font-bold uppercase tracking-[.12em] text-[#6f6d6d]">Meno *</span>
        <input className="landing-field" name="name" placeholder="Vaše meno" autoComplete="name" minLength={2} maxLength={100} required />
      </label>
      <label>
        <span className="block text-xs font-bold uppercase tracking-[.12em] text-[#6f6d6d]">Telefón *</span>
        <input className="landing-field" name="phone" type="tel" placeholder="+421 9…" autoComplete="tel" minLength={7} maxLength={25} required />
      </label>
      <label>
        <span className="block text-xs font-bold uppercase tracking-[.12em] text-[#6f6d6d]">E-mail <span className="normal-case tracking-normal text-[#929a94]">– voliteľný</span></span>
        <input className="landing-field" name="email" type="email" placeholder="meno@email.sk" autoComplete="email" maxLength={254} />
        <span className="mt-1.5 block text-xs text-[#8a938c]">Pošleme sem potvrdenie požiadavky.</span>
      </label>
      <label>
        <span className="block text-xs font-bold uppercase tracking-[.12em] text-[#6f6d6d]">Termín alebo poznámka <span className="normal-case tracking-normal text-[#929a94]">– voliteľné</span></span>
        <input className="landing-field" name="note" placeholder="Napr. termín a počet bicyklov" maxLength={2000} />
      </label>
      <label className="flex items-start gap-3 text-sm leading-relaxed text-[#6f6d6d] sm:col-span-2">
        <input className="mt-1 size-4 shrink-0 accent-[var(--accent)]" type="checkbox" name="consent" required />
        <span>Súhlasím so spracovaním osobných údajov na účely vybavenia mojej požiadavky podľa <Link href="/ochrana-osobnych-udajov" className="underline underline-offset-2">zásad ochrany osobných údajov</Link>. *</span>
      </label>
      {turnstileSiteKey && (
        <div className="sm:col-span-2">
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
          <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-theme="light" />
        </div>
      )}
      {state.message && <p className="text-sm text-[#a1433e] sm:col-span-2" role="alert">{state.message}</p>}
      <div className="sm:col-span-2">
        <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-[var(--accent)] px-6 py-3 font-bold text-white transition hover:bg-[#075eac] disabled:opacity-60 sm:w-auto" type="submit" disabled={pending}>
          {pending && <LoaderCircle size={17} className="animate-spin" />}
          {pending ? "Odosiela sa…" : "Odoslať požiadavku"}
          {!pending && <ArrowRight size={17} />}
        </button>
        <p className="mt-3 text-xs text-[#777474]">Ozveme sa a spoločne dohodneme termín aj detaily.</p>
      </div>
    </form>
  );
}
