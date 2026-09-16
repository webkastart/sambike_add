"use client";

import type { CampaignGalleryItem } from "@/generated/prisma/client";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  GripVertical,
  ImageIcon,
  LayoutList,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CampaignGalleryField, type CampaignGalleryFieldHandle } from "@/components/campaign-gallery-field";
import { CampaignImageField, type CampaignImageFieldHandle } from "@/components/campaign-image-field";
import {
  defaultSectionContent,
  type CampaignSectionContent,
  type CampaignSectionTypeValue,
  type EditableCampaignSection,
  sectionContentString,
} from "@/lib/campaign-sections";

type Props = {
  sections: EditableCampaignSection[];
  galleryItems: CampaignGalleryItem[];
  action: (formData: FormData) => void | Promise<void>;
  previewHref: string;
};

const sectionOptions: Array<{ type: CampaignSectionTypeValue; label: string; description: string }> = [
  { type: "TEXT_IMAGE", label: "Text + obrázok", description: "Obsah s fotografiou" },
  { type: "BENEFITS", label: "Výhody / kroky", description: "2–8 hlavných benefitov" },
  { type: "OFFER", label: "Ponuka", description: "Cena, popis a tlačidlo" },
  { type: "GALLERY", label: "Galéria", description: "Viac fotografií alebo videí" },
  { type: "VIDEO", label: "Video", description: "Samostatný video obsah" },
  { type: "FAQ", label: "FAQ", description: "Otázky a odpovede" },
  { type: "TESTIMONIALS", label: "Referencie", description: "Skutočné skúsenosti zákazníkov" },
  { type: "CTA", label: "Výzva k akcii", description: "Záverečný nadpis a tlačidlo" },
  { type: "FORM", label: "Formulár", description: "Kontaktný formulár pre záujemcov" },
];

const sectionNames: Record<CampaignSectionTypeValue, string> = {
  HERO: "Úvod kampane",
  TEXT_IMAGE: "Text + obrázok",
  BENEFITS: "Výhody / kroky",
  OFFER: "Ponuka",
  GALLERY: "Galéria",
  VIDEO: "Video",
  FAQ: "Časté otázky",
  TESTIMONIALS: "Referencie",
  CTA: "Výzva k akcii",
  FORM: "Formulár",
};

const singleInstanceTypes = new Set<CampaignSectionTypeValue>(["HERO", "GALLERY", "FORM"]);
const nonRemovableTypes = new Set<CampaignSectionTypeValue>(["HERO"]);

function contentItems(content: CampaignSectionContent) {
  return Array.isArray(content.items) ? content.items.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
}

function summary(section: EditableCampaignSection, galleryCount: number) {
  const content = section.content;
  const items = contentItems(content);
  switch (section.type) {
    case "HERO": return sectionContentString(content, "heading", "Bez hlavného nadpisu");
    case "BENEFITS": return `${items.length} ${items.length === 1 ? "položka" : items.length > 1 && items.length < 5 ? "položky" : "položiek"}`;
    case "OFFER": return [sectionContentString(content, "heading"), sectionContentString(content, "priceText")].filter(Boolean).join(" · ") || "Doplňte ponuku";
    case "GALLERY": return `${galleryCount} ${galleryCount === 1 ? "médium" : galleryCount > 1 && galleryCount < 5 ? "médiá" : "médií"}`;
    case "VIDEO": return sectionContentString(content, "heading", "Doplňte video");
    case "FAQ": return `${items.length} ${items.length === 1 ? "otázka" : items.length > 1 && items.length < 5 ? "otázky" : "otázok"}`;
    case "TESTIMONIALS": return `${items.length} ${items.length === 1 ? "referencia" : items.length > 1 && items.length < 5 ? "referencie" : "referencií"}`;
    case "FORM": return sectionContentString(content, "heading", "Kontaktný formulár");
    default: return sectionContentString(content, "heading", "Doplňte obsah");
  }
}

function newSectionId() {
  return `section_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-[3px] bg-[var(--accent-dark)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#075eac] disabled:cursor-wait disabled:opacity-60">{pending ? "Ukladám…" : "Uložiť obsah"}</button>;
}

function TextControl({ label, value, maxLength, multiline = false, required = false, onChange }: {
  label: string;
  value: string;
  maxLength: number;
  multiline?: boolean;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const controlProps = { className: "admin-field", value, maxLength, required, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  return <label className="block"><span className="text-xs font-semibold uppercase tracking-[.1em] text-[#747d76]">{label}</span>{multiline ? <textarea {...controlProps} rows={4} /> : <input {...controlProps} type="text" />}<span className="mt-1 block text-right text-[11px] text-[#98a099]">{value.length} / {maxLength}</span></label>;
}

function StepsEditor({ section, updateContent }: { section: EditableCampaignSection; updateContent: (id: string, key: string, value: unknown) => void }) {
  const steps = Array.isArray(section.content.steps) ? section.content.steps.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
  const updateStep = (index: number, key: string, value: string) => updateContent(section.id, "steps", steps.map((step, stepIndex) => stepIndex === index ? { ...step, [key]: value } : step));
  const moveStep = (source: number, destination: number) => { if (destination < 0 || destination >= steps.length || source === destination) return; const next = [...steps]; const [step] = next.splice(source, 1); next.splice(destination, 0, step); updateContent(section.id, "steps", next); };
  return <div className="border-t border-[var(--line)] pt-6"><div><h4 className="font-semibold">Ako to prebieha</h4><p className="mt-1 text-xs text-[#89918b]">Krátke kroky zobrazené pri úvodnom obsahu.</p></div><div className="mt-4 space-y-3">{steps.map((step, index) => <div key={index} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(index)); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveStep(Number(event.dataTransfer.getData("text/plain")), index); }} className="grid gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-[auto_1fr_1.4fr_auto]"><span className="inline-flex size-9 cursor-grab items-center justify-center text-[#8a938c]" aria-label="Potiahnutím zmeniť poradie"><GripVertical size={16} /></span><TextControl label="Názov kroku" value={typeof step.title === "string" ? step.title : ""} maxLength={80} onChange={(value) => updateStep(index, "title", value)} /><TextControl label="Krátke vysvetlenie" value={typeof step.text === "string" ? step.text : ""} maxLength={240} multiline onChange={(value) => updateStep(index, "text", value)} /><div className="flex items-start pt-5"><button type="button" disabled={index === 0} onClick={() => moveStep(index, index - 1)} className="size-8 disabled:opacity-25" aria-label="Posunúť krok vyššie"><ArrowUp size={15} /></button><button type="button" disabled={index === steps.length - 1} onClick={() => moveStep(index, index + 1)} className="size-8 disabled:opacity-25" aria-label="Posunúť krok nižšie"><ArrowDown size={15} /></button><button type="button" onClick={() => updateContent(section.id, "steps", steps.filter((_, stepIndex) => stepIndex !== index))} className="size-8 text-[#9a4540]" aria-label="Odstrániť krok"><Trash2 size={15} /></button></div></div>)}</div><button type="button" onClick={() => updateContent(section.id, "steps", [...steps, { title: "", text: "" }])} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-dark)]"><Plus size={15} /> Pridať krok</button></div>;
}

export function CampaignContentEditor({ sections: initialSections, galleryItems, action, previewHref }: Props) {
  const [sections, setSections] = useState(() => initialSections.map((section, position) => ({ ...section, position })));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBackup, setEditingBackup] = useState<EditableCampaignSection | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const galleryRef = useRef<CampaignGalleryFieldHandle>(null);
  const heroImageRef = useRef<CampaignImageFieldHandle>(null);
  const offerImageRef = useRef<CampaignImageFieldHandle>(null);
  const galleryOnlyItems = galleryItems.filter((item) => item.placement === "GALLERY");

  function replaceSection(id: string, update: (section: EditableCampaignSection) => EditableCampaignSection) {
    setSections((current) => current.map((section) => section.id === id ? update(section) : section));
  }

  function updateContent(id: string, key: string, value: unknown) {
    replaceSection(id, (section) => ({ ...section, content: { ...section.content, [key]: value } }));
  }

  function moveSection(index: number, destination: number) {
    if (destination < 0 || destination >= sections.length || index === destination) return;
    const next = [...sections];
    const [section] = next.splice(index, 1);
    next.splice(destination, 0, section);
    setSections(next.map((item, position) => ({ ...item, position })));
  }

  function openEditor(section: EditableCampaignSection) {
    setEditingId(section.id);
    setEditingBackup(structuredClone(section));
    setChooserOpen(false);
  }

  function cancelEditor() {
    if (editingBackup) replaceSection(editingBackup.id, () => editingBackup);
    setEditingId(null);
    setEditingBackup(null);
  }

  function addSection(type: CampaignSectionTypeValue) {
    const section: EditableCampaignSection = { id: newSectionId(), type, position: sections.length, isVisible: true, content: defaultSectionContent(type) };
    setSections((current) => [...current, section]);
    setChooserOpen(false);
    openEditor(section);
  }

  function duplicateSection(section: EditableCampaignSection) {
    const copy = { ...structuredClone(section), id: newSectionId(), position: section.position + 1 };
    const next = [...sections];
    next.splice(section.position + 1, 0, copy);
    setSections(next.map((item, position) => ({ ...item, position })));
    openEditor(copy);
  }

  function removeSection(section: EditableCampaignSection) {
    if (!window.confirm(`Odstrániť sekciu „${sectionNames[section.type]}“? Zmena sa prejaví po uložení.`)) return;
    setSections((current) => current.filter((item) => item.id !== section.id).map((item, position) => ({ ...item, position })));
    if (editingId === section.id) setEditingId(null);
  }

  async function submitContent(formData: FormData) {
    setUploadError("");
    try {
      for (const [ref, uploadedName, fileName, sectionType] of [
        [heroImageRef, "imageUploadedMedia", "imageFile", "HERO"],
        [offerImageRef, "offerImageUploadedMedia", "offerImageFile", "OFFER"],
      ] as const) {
        const prepared = await ref.current?.prepareUpload();
        if (prepared?.direct) {
          formData.delete(fileName);
          if (prepared.item) formData.set(uploadedName, JSON.stringify(prepared.item));
        }
        if (prepared?.item) {
          const target = sections.find((section) => section.type === sectionType);
          if (target) target.content.imageUrl = prepared.item.mediaUrl;
        }
      }
      const gallery = await galleryRef.current?.prepareUploads();
      if (gallery?.direct) {
        formData.delete("galleryMediaFiles");
        gallery.items.forEach((item) => formData.append("galleryUploadedMedia", JSON.stringify(item)));
      }
      formData.set("campaignSections", JSON.stringify(sections));
      await action(formData);
    } catch (error) {
      unstable_rethrow(error);
      setUploadError(error instanceof Error ? error.message : "Obsah sa nepodarilo uložiť. Skúste to znova.");
    }
  }

  const unavailableTypes = new Set(sections.filter((section) => singleInstanceTypes.has(section.type)).map((section) => section.type));

  return (
    <section className="mt-12" aria-labelledby="page-content-title">
      <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a938c]">Landing page</p><h2 id="page-content-title" className="mt-1 text-2xl font-semibold">Obsah stránky</h2><p className="mt-2 max-w-2xl text-sm text-[#737c75]">Upravujte iba obsah. Vzhľad a rozloženie jednotlivých typov sekcií zabezpečuje aplikácia.</p></div>
        <Link href={previewHref} target="_blank" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--accent-dark)]"><Eye size={16} /> Náhľad stránky</Link>
      </div>

      <form action={submitContent} className="mt-6">
        <div className="space-y-3">
          {sections.map((section, index) => {
            const editing = editingId === section.id;
            return <article
              key={section.id}
              draggable={!editing}
              onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", section.id); setDraggedIndex(index); }}
              onDragEnd={() => setDraggedIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => { if (draggedIndex !== null) moveSection(draggedIndex, index); setDraggedIndex(null); }}
              className={`border transition ${editing ? "border-[#a8b4aa] bg-[#fbfcfa]" : "border-[var(--line)] bg-white"} ${draggedIndex === index ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
                <span className="hidden cursor-grab text-[#929a94] sm:inline-flex" aria-label="Potiahnutím zmeniť poradie"><GripVertical size={18} /></span>
                <div className="min-w-0 flex-1"><h3 className="font-semibold">{sectionNames[section.type]}</h3><p className="mt-0.5 truncate text-sm text-[#788179]">{summary(section, galleryOnlyItems.length)}</p></div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-[#657067]"><input type="checkbox" className="size-4 accent-[#26372a]" checked={section.isVisible} onChange={(event) => replaceSection(section.id, (item) => ({ ...item, isVisible: event.target.checked }))} /><span className="hidden sm:inline">{section.isVisible ? "Viditeľná" : "Skrytá"}</span></label>
                <div className="flex items-center">
                  <button type="button" className="inline-flex size-9 items-center justify-center text-[#687169] disabled:opacity-25" disabled={index === 0} onClick={() => moveSection(index, index - 1)} aria-label={`Posunúť sekciu ${sectionNames[section.type]} vyššie`}><ArrowUp size={16} /></button>
                  <button type="button" className="inline-flex size-9 items-center justify-center text-[#687169] disabled:opacity-25" disabled={index === sections.length - 1} onClick={() => moveSection(index, index + 1)} aria-label={`Posunúť sekciu ${sectionNames[section.type]} nižšie`}><ArrowDown size={16} /></button>
                </div>
                <button type="button" className="text-sm font-semibold text-[var(--accent-dark)]" onClick={() => editing ? cancelEditor() : openEditor(section)}>{editing ? "Zavrieť" : "Upraviť"}</button>
              </div>

              {editing && <div className="border-t border-[var(--line)] px-4 py-6 sm:px-12">
                <SectionFields section={section} updateContent={updateContent} galleryItems={galleryOnlyItems} galleryRef={galleryRef} heroImageRef={heroImageRef} offerImageRef={offerImageRef} />
                <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[var(--line)] pt-5">
                  <button type="button" onClick={() => { setEditingId(null); setEditingBackup(null); }} className="text-sm font-semibold text-[var(--accent-dark)]">Hotovo</button>
                  <button type="button" onClick={cancelEditor} className="text-sm text-[#6f786f]">Zrušiť úpravy sekcie</button>
                  {!singleInstanceTypes.has(section.type) && <button type="button" onClick={() => duplicateSection(section)} className="inline-flex items-center gap-1.5 text-sm text-[#59655c]"><Copy size={14} /> Duplikovať</button>}
                  {!nonRemovableTypes.has(section.type) && <button type="button" onClick={() => removeSection(section)} className="ml-auto inline-flex items-center gap-1.5 text-sm text-[#9a4540]"><Trash2 size={14} /> Odstrániť sekciu</button>}
                </div>
              </div>}
            </article>;
          })}
        </div>

        <div className="mt-5">
          <button type="button" onClick={() => { setChooserOpen((open) => !open); setEditingId(null); }} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-dark)]"><Plus size={17} /> Pridať sekciu</button>
          {chooserOpen && <div className="mt-4 grid gap-3 border-y border-[var(--line)] py-5 sm:grid-cols-2 lg:grid-cols-3">
            {sectionOptions.filter((option) => !unavailableTypes.has(option.type)).map((option) => <button key={option.type} type="button" onClick={() => addSection(option.type)} className="group flex items-start gap-3 border border-[var(--line)] bg-white p-4 text-left transition hover:border-[#aab6ac] hover:bg-[#fbfcfa]"><span className="mt-0.5 text-[var(--accent)]">{option.type === "GALLERY" ? <ImageIcon size={18} /> : <LayoutList size={18} />}</span><span><strong className="block text-sm">{option.label}</strong><span className="mt-1 block text-xs text-[#7a837c]">{option.description}</span></span></button>)}
          </div>}
        </div>

        {uploadError && <p className="mt-5 border-l-2 border-[#a1433e] bg-[#fff7f6] px-4 py-3 text-sm text-[#8f332f]" role="alert">{uploadError}</p>}
        <div className="sticky bottom-0 z-20 mt-8 flex flex-wrap items-center gap-4 border-t border-[var(--line)] bg-white/95 py-4 backdrop-blur"><SaveButton /><Link href={previewHref} target="_blank" className="inline-flex items-center gap-2 text-sm font-semibold"><Eye size={15} /> Náhľad stránky</Link><span className="text-xs text-[#89918b]">Poradie, viditeľnosť aj obsah sa uložia naraz.</span></div>
      </form>
    </section>
  );
}

function SectionFields({ section, updateContent, galleryItems, galleryRef, heroImageRef, offerImageRef }: {
  section: EditableCampaignSection;
  updateContent: (id: string, key: string, value: unknown) => void;
  galleryItems: CampaignGalleryItem[];
  galleryRef: React.RefObject<CampaignGalleryFieldHandle | null>;
  heroImageRef: React.RefObject<CampaignImageFieldHandle | null>;
  offerImageRef: React.RefObject<CampaignImageFieldHandle | null>;
}) {
  const value = (key: string) => sectionContentString(section.content, key);
  const field = (key: string) => (next: string) => updateContent(section.id, key, next);
  const common = <div className="grid gap-5 sm:grid-cols-2"><TextControl label="Malý nadpis" value={value("eyebrow")} maxLength={100} onChange={field("eyebrow")} /><TextControl label="Hlavný nadpis" value={value("heading")} maxLength={180} required onChange={field("heading")} /><div className="sm:col-span-2"><TextControl label="Krátky popis" value={value("description")} maxLength={1200} multiline onChange={field("description")} /></div></div>;

  if (section.type === "HERO" || section.type === "OFFER") return <div className="space-y-7">{common}<div className="grid gap-5 sm:grid-cols-2">{section.type === "OFFER" && <TextControl label="Cena alebo podmienky" value={value("priceText")} maxLength={180} required onChange={field("priceText")} />}<TextControl label="Text tlačidla" value={value("ctaLabel")} maxLength={80} required onChange={field("ctaLabel")} /></div><CampaignImageField ref={section.type === "HERO" ? heroImageRef : offerImageRef} label={section.type === "HERO" ? "Úvodný obrázok" : "Obrázok ponuky"} description="Vyberte fotografiu, ktorá sa zobrazí v tejto sekcii." fileName={section.type === "HERO" ? "imageFile" : "offerImageFile"} urlName={section.type === "HERO" ? "imageUrl" : "offerImageUrl"} currentImageUrl={value("imageUrl") || (section.type === "HERO" ? "/sambike_store1.jpeg" : "/sambike_image.jpeg")} />{section.type === "HERO" && <StepsEditor section={section} updateContent={updateContent} />}</div>;

  if (section.type === "GALLERY") return <div className="space-y-7">{common}<input type="hidden" name="galleryEditorPresent" value="1" /><CampaignGalleryField ref={galleryRef} items={galleryItems} galleryOnly /></div>;

  if (section.type === "BENEFITS" || section.type === "FAQ" || section.type === "TESTIMONIALS") {
    const items = contentItems(section.content);
    const keys = section.type === "FAQ" ? ["question", "answer"] as const : section.type === "TESTIMONIALS" ? ["name", "text"] as const : ["title", "text"] as const;
    const labels = section.type === "FAQ" ? ["Otázka", "Odpoveď"] : section.type === "TESTIMONIALS" ? ["Meno", "Text referencie"] : ["Názov", "Vysvetlenie"];
    const singular = section.type === "FAQ" ? "otázku" : section.type === "TESTIMONIALS" ? "referenciu" : "položku";
    const updateItem = (index: number, key: string, nextValue: string) => updateContent(section.id, "items", items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: nextValue } : item));
    const moveItem = (index: number, offset: -1 | 1) => { const next = [...items]; const destination = index + offset; if (destination < 0 || destination >= next.length) return; [next[index], next[destination]] = [next[destination], next[index]]; updateContent(section.id, "items", next); };
    const dropItem = (source: number, destination: number) => { if (!Number.isInteger(source) || source === destination || source < 0 || source >= items.length) return; const next = [...items]; const [moved] = next.splice(source, 1); next.splice(destination, 0, moved); updateContent(section.id, "items", next); };
    return <div className="space-y-7">{common}<div className="space-y-3">{items.map((item, index) => <div key={index} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(index)); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); dropItem(Number(event.dataTransfer.getData("text/plain")), index); }} className="grid gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-[auto_1fr_1.4fr_auto]"><span className="inline-flex size-9 cursor-grab items-center justify-center text-[#8a938c]" aria-label="Potiahnutím zmeniť poradie"><GripVertical size={16} /></span><TextControl label={labels[0]} value={typeof item[keys[0]] === "string" ? item[keys[0]] as string : ""} maxLength={section.type === "FAQ" ? 160 : 100} onChange={(next) => updateItem(index, keys[0], next)} /><TextControl label={labels[1]} value={typeof item[keys[1]] === "string" ? item[keys[1]] as string : ""} maxLength={section.type === "FAQ" ? 600 : 500} multiline onChange={(next) => updateItem(index, keys[1], next)} /><div className="flex items-start pt-5"><button type="button" disabled={index === 0} onClick={() => moveItem(index, -1)} className="size-8 disabled:opacity-25" aria-label="Posunúť položku vyššie"><ArrowUp size={15} /></button><button type="button" disabled={index === items.length - 1} onClick={() => moveItem(index, 1)} className="size-8 disabled:opacity-25" aria-label="Posunúť položku nižšie"><ArrowDown size={15} /></button><button type="button" onClick={() => updateContent(section.id, "items", items.filter((_, itemIndex) => itemIndex !== index))} className="size-8 text-[#9a4540]" aria-label="Odstrániť položku"><Trash2 size={15} /></button></div></div>)}<button type="button" onClick={() => updateContent(section.id, "items", [...items, { [keys[0]]: "", [keys[1]]: "" }])} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-dark)]"><Plus size={15} /> Pridať {singular}</button></div></div>;
  }

  if (section.type === "VIDEO") return <div className="space-y-7">{common}<TextControl label="Odkaz na video" value={value("videoUrl")} maxLength={1000} onChange={field("videoUrl")} /><TextControl label="Popis videa" value={value("caption")} maxLength={240} onChange={field("caption")} /></div>;
  if (section.type === "CTA") return <div className="space-y-7">{common}<div className="grid gap-5 sm:grid-cols-2"><TextControl label="Text tlačidla" value={value("ctaLabel")} maxLength={80} onChange={field("ctaLabel")} /><TextControl label="Kam tlačidlo vedie" value={value("href")} maxLength={1000} onChange={field("href")} /></div></div>;
  if (section.type === "TEXT_IMAGE") return <div className="space-y-7">{common}<div className="grid gap-5 sm:grid-cols-2"><TextControl label="Odkaz na obrázok" value={value("imageUrl")} maxLength={1000} onChange={field("imageUrl")} /><TextControl label="Popis obrázka" value={value("imageAlt")} maxLength={240} onChange={field("imageAlt")} /></div></div>;
  return common;
}
