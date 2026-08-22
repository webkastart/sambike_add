import {
  ArrowRight,
  BarChart3,
  FileCheck2,
  Image as ImageIcon,
  Link2,
  Mail,
  Megaphone,
} from "lucide-react";

type Props = {
  metaPixelConfigured: boolean;
  emailConfigured: boolean;
};

const flow = [
  { number: "01", label: "Reklama", detail: "Facebook / Instagram" },
  { number: "02", label: "Landing page", detail: "Verejná URL kampane" },
  { number: "03", label: "Formulár", detail: "Kontakt a súhlas" },
  { number: "04", label: "Záujemca", detail: "Administrácia + e-mail" },
];

const guideItems = [
  {
    icon: ImageIcon,
    title: "Ako fungujú obrázky",
    text: "Každá kampaň má jednu hlavnú fotografiu. Zobrazuje sa v úvode landing page aj pri ponuke a podľa obrazovky sa automaticky oreže. Najlepšie funguje čistá široká fotografia s rozmerom aspoň 1 600 px bez dôležitého textu pri okrajoch.",
  },
  {
    icon: Megaphone,
    title: "Facebook a Instagram",
    text: "Reklama sa vytvára v Meta Ads Manageri. Ako cieľový odkaz sa do nej vloží verejná URL kampane, ktorú možno použiť pre Facebook aj Instagram. Táto aplikácia reklamy sama nepublikuje ani nemení ich rozpočet.",
  },
  {
    icon: BarChart3,
    title: "Priemerný dosah (reach)",
    text: "Dosah nie je pevné číslo — ovplyvňuje ho rozpočet, publikum, obdobie aj kvalita reklamy. Meta pred spustením ukáže odhad a po spustení reálny reach. Táto administrácia počíta získané kontakty, nie impresie ani dosah.",
  },
  {
    icon: Link2,
    title: "Prepojenie kampane",
    text: "Každá kampaň má vlastný odkaz /kampan/nazov. Ak sa k odkazu pridajú UTM parametre, pri záujemcovi sa uloží zdroj, názov kampane aj konkrétna reklama. Vďaka tomu je jasné, odkiaľ kontakt prišiel.",
  },
  {
    icon: FileCheck2,
    title: "Formulár",
    text: "Záujemca vyplní meno, telefón, voliteľný e-mail a poznámku a potvrdí súhlas. Po odoslaní sa kontakt ihneď uloží medzi Záujemcov. Ak je nastavený Meta Pixel, odošle sa aj udalosť Lead.",
  },
  {
    icon: Mail,
    title: "E-mailové upozornenie",
    text: "Po každom platnom formulári systém odošle notifikáciu s kontaktom a odkazom na detail. Ak záujemca zadal e-mail, stačí na správu odpovedať. Kontakt zostane bezpečne uložený aj v prípade, že sa e-mail nepodarí doručiť.",
  },
];

export function CampaignGuide({ metaPixelConfigured, emailConfigured }: Props) {
  return (
    <section className="mt-14 border-y border-[var(--line)] py-11" aria-labelledby="campaign-guide-title">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.58fr)] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Ako to funguje</p>
          <h2 id="campaign-guide-title" className="mt-2 max-w-xl text-2xl font-semibold tracking-[-.035em] sm:text-3xl">
            Od reklamy k novému záujemcovi
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#737c75]">
            Kampaň spojí reklamu na sociálnych sieťach s vlastnou stránkou, formulárom a upozornením pre SAMBIKE.
          </p>
        </div>

        <dl className="grid gap-2 text-xs text-[#68736a] sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className={`size-1.5 shrink-0 rounded-full ${metaPixelConfigured ? "bg-[#7da33e]" : "bg-[#c59b45]"}`} />
            <dt className="sr-only">Meta Pixel</dt>
            <dd>Meta Pixel {metaPixelConfigured ? "je aktívny" : "treba nastaviť"}</dd>
          </div>
          <div className="flex items-center gap-2">
            <span className={`size-1.5 shrink-0 rounded-full ${emailConfigured ? "bg-[#7da33e]" : "bg-[#c59b45]"}`} />
            <dt className="sr-only">E-mailové upozornenia</dt>
            <dd>E-mailové upozornenia {emailConfigured ? "sú aktívne" : "treba nastaviť"}</dd>
          </div>
        </dl>
      </div>

      <ol className="mt-9 grid gap-x-5 gap-y-4 sm:grid-cols-4" aria-label="Cesta nového záujemcu">
        {flow.map((step, index) => (
          <li key={step.number} className="relative border-t border-[#d8ded8] pt-4">
            <p className="text-[.68rem] font-semibold tracking-[.12em] text-[#8b948d]">{step.number}</p>
            <p className="mt-1 text-sm font-semibold">{step.label}</p>
            <p className="mt-0.5 text-xs text-[#818a83]">{step.detail}</p>
            {index < flow.length - 1 && (
              <ArrowRight className="absolute -right-3 top-4 hidden text-[#a5ada7] sm:block" size={14} aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-x-12 sm:grid-cols-2">
        {guideItems.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 border-t border-[var(--line)] py-6">
              <Icon size={17} strokeWidth={1.7} className="mt-0.5 text-[#71805c]" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#707a72]">{item.text}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
