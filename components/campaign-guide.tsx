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
  metaAdsConfigured: boolean;
  metaPixelConfigured: boolean;
  emailConfigured: boolean;
};

const flow = [
  { number: "01", label: "Reklama", detail: "Facebook a Instagram" },
  { number: "02", label: "Stránka kampane", detail: "Verejný odkaz" },
  { number: "03", label: "Formulár", detail: "Údaje a súhlas" },
  { number: "04", label: "Záujemca", detail: "Administrácia a e-mail" },
];

const guideItems = [
  {
    icon: ImageIcon,
    title: "Ako fungujú obrázky",
    text: "Hlavná fotografia sa zobrazuje v úvode stránky aj pri ponuke. Použite široký záber s rozlíšením aspoň 1 600 px a bez dôležitého textu pri okrajoch, pretože fotografia sa môže podľa obrazovky orezať.",
  },
  {
    icon: Megaphone,
    title: "Facebook a Instagram",
    text: "V detaile kampane nastavíte Facebook, Instagram, publikum, termín aj denný rozpočet. Reklama sa najprv bezpečne vytvorí ako pozastavená a spustíte ju samostatným tlačidlom.",
  },
  {
    icon: BarChart3,
    title: "Dosah reklamy",
    text: "Po spustení môžete pri kampani načítať minutý rozpočet, zobrazenia, kliknutia a Meta leady a porovnať ich s kontaktmi uloženými v administrácii.",
  },
  {
    icon: Link2,
    title: "Prepojenie kampane",
    text: "Každá reklama automaticky používa verejný odkaz svojej kampane a dostane UTM parametre. Pri záujemcovi sa tak uloží zdroj aj názov kampane.",
  },
  {
    icon: FileCheck2,
    title: "Formulár",
    text: "Záujemca vyplní meno, telefón, voliteľný e-mail a poznámku a potvrdí súhlas. Po odoslaní formulára sa ihneď uloží do administrácie. Ak je nastavený Meta Pixel, odošle sa aj udalosť Lead.",
  },
  {
    icon: Mail,
    title: "E-mailové upozornenie",
    text: "Po odoslaní formulára príde e-mail s údajmi záujemcu a odkazom na detail. Ak záujemca uviedol e-mail, môžete na správu rovno odpovedať. Záujemca zostane uložený aj vtedy, keď sa upozornenie nepodarí doručiť.",
  },
];

export function CampaignGuide({ metaAdsConfigured, metaPixelConfigured, emailConfigured }: Props) {
  return (
    <section className="mt-14 border-y border-[var(--line)] py-11" aria-labelledby="campaign-guide-title">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.58fr)] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#7c867e]">Ako to funguje</p>
          <h2 id="campaign-guide-title" className="mt-2 max-w-xl text-2xl font-semibold tracking-[-.035em] sm:text-3xl">
            Od reklamy k novému záujemcovi
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#737c75]">
            Reklama odkáže na stránku kampane. Odtiaľ sa vyplnený formulár uloží do administrácie a odošle e-mailové upozornenie.
          </p>
        </div>

        <dl className="grid gap-2 text-xs text-[#68736a] sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <div className="flex items-center gap-2">
            <span className={`size-1.5 shrink-0 rounded-full ${metaAdsConfigured ? "bg-[#7da33e]" : "bg-[#c59b45]"}`} />
            <dt className="sr-only">Meta reklamy</dt>
            <dd>Meta reklamy {metaAdsConfigured ? "sú pripojené" : "treba pripojiť"}</dd>
          </div>
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
