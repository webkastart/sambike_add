"use client";

import { AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { type MouseEvent, useState } from "react";
import {
  campaignAiPrompt,
  campaignJsonBooleanFields,
  type CampaignJsonDocument,
  campaignJsonItemsFromText,
  campaignJsonItemsToText,
  campaignJsonStringFields,
  campaignJsonStructuredFields,
  parseCampaignJson,
} from "@/lib/campaign-json";

type Message = { kind: "success" | "error"; text: string } | null;

function namedFormElement(form: HTMLFormElement, name: string) {
  const element = form.elements.namedItem(name);
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    ? element
    : null;
}

function readCampaignJson(form: HTMLFormElement): CampaignJsonDocument {
  const strings = Object.fromEntries(campaignJsonStringFields.map((field) => [
    field,
    namedFormElement(form, field)?.value ?? "",
  ])) as Record<(typeof campaignJsonStringFields)[number], string>;
  const booleans = Object.fromEntries(campaignJsonBooleanFields.map((field) => [
    field,
    (namedFormElement(form, field) as HTMLInputElement | null)?.checked ?? false,
  ])) as Record<(typeof campaignJsonBooleanFields)[number], boolean>;

  return {
    schemaVersion: 1,
    ...strings,
    ...booleans,
    benefits: campaignJsonItemsFromText(namedFormElement(form, "benefits")?.value ?? "", "benefits") as CampaignJsonDocument["benefits"],
    processSteps: campaignJsonItemsFromText(namedFormElement(form, "processSteps")?.value ?? "", "processSteps") as CampaignJsonDocument["processSteps"],
    faq: campaignJsonItemsFromText(namedFormElement(form, "faq")?.value ?? "", "faq") as CampaignJsonDocument["faq"],
    testimonials: campaignJsonItemsFromText(namedFormElement(form, "testimonials")?.value ?? "", "testimonials") as CampaignJsonDocument["testimonials"],
  };
}

async function writeClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const fallback = document.createElement("textarea");
  fallback.value = value;
  fallback.style.position = "fixed";
  fallback.style.opacity = "0";
  document.body.appendChild(fallback);
  fallback.select();
  const copied = document.execCommand("copy");
  fallback.remove();
  if (!copied) throw new Error("Clipboard is unavailable");
}

function updateFormElement(element: HTMLInputElement | HTMLTextAreaElement, value: string | boolean) {
  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    element.checked = Boolean(value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  const prototype = element instanceof HTMLInputElement
    ? HTMLInputElement.prototype
    : HTMLTextAreaElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (valueSetter) valueSetter.call(element, String(value));
  else element.value = String(value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function CampaignJsonAssistant() {
  const [instruction, setInstruction] = useState("");
  const [json, setJson] = useState("");
  const [message, setMessage] = useState<Message>(null);

  async function copyPrompt(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    try {
      await writeClipboard(campaignAiPrompt(readCampaignJson(form), instruction));
      setMessage({ kind: "success", text: "Opis kampane aj aktuálna JSON šablóna sú skopírované. Vložte zadanie do AI." });
    } catch {
      setMessage({ kind: "error", text: "Kopírovanie zlyhalo. Skontrolujte povolenie schránky v prehliadači a skúste to znova." });
    }
  }

  function applyJson(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    const result = parseCampaignJson(json);
    if (!result.success) {
      setMessage({ kind: "error", text: result.error });
      return;
    }

    for (const field of campaignJsonStringFields) {
      const element = namedFormElement(form, field);
      if (element) updateFormElement(element, result.data[field]);
    }
    for (const field of campaignJsonBooleanFields) {
      const element = namedFormElement(form, field);
      if (element) updateFormElement(element, result.data[field]);
    }
    for (const field of campaignJsonStructuredFields) {
      const element = namedFormElement(form, field);
      if (element) updateFormElement(element, campaignJsonItemsToText(result.data[field], field));
    }

    setMessage({ kind: "success", text: "Formulár je vyplnený z JSON. Skontrolujte údaje a vytvorte koncept kampane." });
  }

  return (
    <details className="mb-9 border-y border-[var(--line)] py-5" open>
      <summary className="cursor-pointer text-lg font-semibold">Vyplniť kampaň pomocou AI a JSON</summary>
      <div className="mt-4 max-w-3xl">
        <p className="text-sm leading-relaxed text-[#737c75]">
          Najprv opíšte kampaň, potom skopírujte pripravené zadanie do AI a výsledný JSON vložte späť. Vyplnia sa všetky texty, kontakty, SEO údaje aj prepínače; fotografie môžete ponechať alebo potom nahrať.
        </p>
        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Opis kampane</span>
          <textarea
            className="admin-field mt-1 min-h-28 text-sm leading-relaxed"
            value={instruction}
            onChange={(event) => {
              setInstruction(event.target.value);
              setMessage(null);
            }}
            placeholder="Čo propagujete, pre koho je ponuka, aká je cena alebo podmienky a ktoré fakty musí AI zachovať?"
            maxLength={2000}
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button
            className="inline-flex items-center gap-2 rounded-[3px] border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold transition hover:border-[#b9c2bb] hover:bg-[#f7f8f7] disabled:cursor-not-allowed disabled:opacity-45"
            type="button"
            disabled={!instruction.trim()}
            onClick={copyPrompt}
          >
            <Copy size={16} aria-hidden="true" />
            Kopírovať zadanie pre AI
          </button>
          <span className="text-xs text-[#89918b]">Šablóna obsahuje aktuálne hodnoty formulára.</span>
        </div>
        <label className="mt-6 block">
          <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">JSON od AI</span>
          <textarea
            className="admin-field mt-1 min-h-48 font-mono text-xs leading-relaxed"
            value={json}
            onChange={(event) => {
              setJson(event.target.value);
              setMessage(null);
            }}
            placeholder={'{\n  "schemaVersion": 1,\n  "name": "..."\n}' }
            spellCheck={false}
          />
        </label>
        <button
          className="mt-3 rounded-[3px] bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#393535] disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!json.trim()}
          onClick={applyJson}
        >
          Vyplniť formulár z JSON
        </button>
        {message && (
          <p
            className={`mt-4 flex items-start gap-2 text-sm ${message.kind === "success" ? "text-[#35623d]" : "text-[#a1433e]"}`}
            role={message.kind === "error" ? "alert" : "status"}
          >
            {message.kind === "success"
              ? <CheckCircle2 className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
              : <AlertCircle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />}
            <span>{message.text}</span>
          </p>
        )}
      </div>
    </details>
  );
}
