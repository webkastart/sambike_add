"use client";

import { AlertCircle, CheckCircle2, Copy, Sparkles } from "lucide-react";
import { type MouseEvent, useState } from "react";
import {
  campaignSettingsAiDefinitions,
  campaignSettingsAiPrompt,
  type CampaignSettingsAiSection,
  parseCampaignSettingsAiJson,
} from "@/lib/campaign-settings-ai";

type Message = { kind: "success" | "error"; text: string } | null;

function namedFormElement(form: HTMLFormElement, name: string) {
  const element = form.elements.namedItem(name);
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    ? element
    : null;
}

function readSectionValues(form: HTMLFormElement, sectionType: CampaignSettingsAiSection) {
  return Object.fromEntries(campaignSettingsAiDefinitions[sectionType].fields.map((field) => {
    const element = namedFormElement(form, field.name);
    const value = element instanceof HTMLInputElement && element.type === "checkbox"
      ? element.checked
      : element?.value ?? "";
    return [field.name, value];
  }));
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

export function CampaignSettingsAiAssistant({ sectionType }: { sectionType: CampaignSettingsAiSection }) {
  const definition = campaignSettingsAiDefinitions[sectionType];
  const [instruction, setInstruction] = useState("");
  const [json, setJson] = useState("");
  const [message, setMessage] = useState<Message>(null);

  async function copyPrompt(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    try {
      await writeClipboard(campaignSettingsAiPrompt(sectionType, instruction, readSectionValues(form, sectionType)));
      setMessage({ kind: "success", text: "Opis úpravy aj aktuálny JSON časti sú skopírované. Vložte zadanie do AI." });
    } catch {
      setMessage({ kind: "error", text: "Kopírovanie zlyhalo. Skontrolujte povolenie schránky a skúste to znova." });
    }
  }

  function applyJson(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    const result = parseCampaignSettingsAiJson(json, sectionType);
    if (!result.success) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    for (const [name, value] of Object.entries(result.data)) {
      const element = namedFormElement(form, name);
      if (element) updateFormElement(element, value);
    }
    setMessage({ kind: "success", text: `Hodnoty časti „${definition.label}“ sú vyplnené z JSON. Skontrolujte ich a uložte nastavenia.` });
  }

  return (
    <details className="border-y border-[var(--line)] py-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-[var(--accent-dark)]">
        <Sparkles size={16} aria-hidden="true" /> Upraviť s AI
      </summary>
      <div className="mt-5 max-w-3xl">
        <p className="text-sm leading-relaxed text-[#737c75]">Opíšte požadovanú zmenu, skopírujte zadanie s aktuálnymi hodnotami do AI a výsledný JSON vložte späť.</p>
        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-[.1em] text-[#747d76]">Čo chcete zmeniť?</span>
          <textarea
            className="admin-field mt-1 min-h-24 text-sm leading-relaxed"
            value={instruction}
            onChange={(event) => { setInstruction(event.target.value); setMessage(null); }}
            placeholder="Napríklad: Uprav text stručnejšie a zachovaj všetky existujúce fakty a odkazy."
            maxLength={1500}
          />
        </label>
        <button
          type="button"
          disabled={!instruction.trim()}
          onClick={copyPrompt}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Copy size={14} aria-hidden="true" /> Kopírovať zadanie s aktuálnym JSON
        </button>
        <label className="mt-5 block">
          <span className="text-xs font-semibold uppercase tracking-[.1em] text-[#747d76]">JSON od AI</span>
          <textarea
            className="admin-field mt-1 min-h-40 font-mono text-xs leading-relaxed"
            value={json}
            onChange={(event) => { setJson(event.target.value); setMessage(null); }}
            placeholder={'{\n  "schemaVersion": 1,\n  "sectionType": "' + sectionType + '",\n  "fields": { ... }\n}'}
            spellCheck={false}
          />
        </label>
        <button
          type="button"
          disabled={!json.trim()}
          onClick={applyJson}
          className="mt-3 rounded-[3px] bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#393535] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Použiť JSON v časti
        </button>
        {message && (
          <p className={`mt-4 flex items-start gap-2 text-sm ${message.kind === "success" ? "text-[#35623d]" : "text-[#a1433e]"}`} role={message.kind === "error" ? "alert" : "status"}>
            {message.kind === "success" ? <CheckCircle2 className="mt-0.5 shrink-0" size={17} aria-hidden="true" /> : <AlertCircle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />}
            <span>{message.text}</span>
          </p>
        )}
      </div>
    </details>
  );
}
