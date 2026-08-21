"use client";

import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { createLead, type LeadFormState } from "@/app/actions";

const initialState: LeadFormState = { success: false, message: "" };

export function LeadForm({ campaignId, offerType }: { campaignId: string; offerType: string }) {
  const [state, formAction, pending] = useActionState(createLead, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  if (state.success) {
    return (
      <div className="py-12 text-center" role="status">
        <CheckCircle2 className="mx-auto text-[#4d6537]" size={38} strokeWidth={1.6} />
        <h3 className="mt-5 text-2xl font-semibold">Máme váš kontakt</h3>
        <p className="mx-auto mt-2 max-w-sm text-[#677169]">{state.message}</p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="mt-9 grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <label>
        <span className="mb-2 block text-sm font-medium">Meno *</span>
        <input className="landing-field" name="name" placeholder="Vaše meno" autoComplete="name" required />
      </label>
      <label>
        <span className="mb-2 block text-sm font-medium">Telefón *</span>
        <input className="landing-field" name="phone" type="tel" placeholder="+421 9…" autoComplete="tel" required />
      </label>
      <label>
        <span className="mb-2 block text-sm font-medium">E-mail</span>
        <input className="landing-field" name="email" type="email" placeholder="meno@email.sk" autoComplete="email" />
      </label>
      <label>
        <span className="mb-2 block text-sm font-medium">Typ záujmu *</span>
        <select className="landing-field" name="interestType" defaultValue={offerType} required>
          <option value={offerType}>{offerType}</option>
          <option value="Chcem viac informácií">Chcem viac informácií</option>
          <option value="Chcem rezervovať termín">Chcem rezervovať termín</option>
          <option value="Iné">Iné</option>
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="mb-2 block text-sm font-medium">Poznámka</span>
        <textarea className="landing-field min-h-28 resize-y" name="note" placeholder="Termín, počet bicyklov alebo čokoľvek, čo máme vedieť…" />
      </label>
      <label className="flex items-start gap-3 text-sm leading-relaxed text-[#657067] sm:col-span-2">
        <input className="mt-1 size-4 shrink-0 accent-[#26372a]" type="checkbox" name="consent" required />
        Súhlasím so spracovaním osobných údajov na účely vybavenia mojej požiadavky. *
      </label>
      {state.message && <p className="text-sm text-[#a1433e] sm:col-span-2" role="alert">{state.message}</p>}
      <div className="sm:col-span-2">
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--accent-dark)] px-6 py-3 font-semibold text-white transition hover:bg-[#314336] disabled:opacity-60"
          type="submit"
          disabled={pending}
        >
          {pending && <LoaderCircle size={17} className="animate-spin" />}
          {pending ? "Odosielam…" : "Odoslať nezáväzný záujem"}
        </button>
      </div>
    </form>
  );
}
