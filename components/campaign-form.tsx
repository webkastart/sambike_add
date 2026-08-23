import type { Campaign } from "@/generated/prisma/client";

type Props = {
  campaign?: Campaign;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
};

type CampaignField = {
  name: "name" | "slug" | "headline" | "priceText" | "ctaText" | "offerType" | "phone" | "email" | "imageUrl";
  label: string;
  placeholder: string;
  required: boolean;
  type?: "text" | "email";
  wide?: boolean;
};

const fields: CampaignField[] = [
  { name: "name", label: "Názov kampane", placeholder: "Požičovňa e-bikov", required: true },
  { name: "slug", label: "Adresa stránky", placeholder: "pozicovna", required: true },
  { name: "headline", label: "Hlavný nadpis", placeholder: "Objavte Slovenský raj na dvoch kolesách", required: true },
  { name: "priceText", label: "Cena alebo podmienky", placeholder: "od 29 € / deň", required: true },
  { name: "ctaText", label: "Text hlavného tlačidla", placeholder: "Rezervovať bicykel", required: true },
  { name: "offerType", label: "Typ ponuky", placeholder: "Požičovňa", required: true },
  { name: "phone", label: "Telefón", placeholder: "+421 905 123 456", required: true },
  { name: "email", label: "E-mail", placeholder: "ahoj@sambike.sk", required: true, type: "email" },
  { name: "imageUrl", label: "Hlavný obrázok", placeholder: "/foto.jpg alebo https://…", required: true, wide: true },
];

export function CampaignForm({ campaign, action, submitLabel }: Props) {
  return (
    <form action={action} className="mt-10 max-w-4xl">
      <div className="grid gap-x-12 gap-y-7 md:grid-cols-2">
        {fields.map((field) => (
          <label key={field.name} className={field.wide ? "md:col-span-2" : ""}>
            <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">{field.label}</span>
            <input
              className="admin-field"
              name={field.name}
              type={field.type ?? "text"}
              defaultValue={campaign?.[field.name] ?? ""}
              placeholder={field.placeholder}
              required={field.required}
            />
          </label>
        ))}
        <label className="md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#747d76]">Krátky popis</span>
          <textarea
            className="admin-field"
            name="description"
            defaultValue={campaign?.description ?? ""}
            placeholder="Stručne opíšte ponuku a jej hlavné výhody."
            required
          />
        </label>
      </div>

      <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4 border-t border-[var(--line)] pt-7">
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input className="size-4 accent-[#26372a]" type="checkbox" name="formEnabled" defaultChecked={campaign?.formEnabled ?? true} />
          Zobraziť formulár pre záujemcov
        </label>
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input className="size-4 accent-[#26372a]" type="checkbox" name="isActive" defaultChecked={campaign?.isActive ?? true} />
          Kampaň je aktívna
        </label>
      </div>

      <div className="mt-10 flex items-center gap-4">
        <button className="rounded-lg bg-[var(--accent-dark)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#314336]" type="submit">
          {submitLabel}
        </button>
        <span className="text-xs text-[#89918b]">Diakritiku a medzery v adrese upravíme automaticky.</span>
      </div>
    </form>
  );
}
