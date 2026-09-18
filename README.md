# SAMBIKE Ads

Lokálne MVP pre správu reklamných kampaní a dynamických landing pages servisu bicyklov Sambike. Každá kampaň používa rovnakú responzívnu šablónu a vlastné dáta podľa slug-u.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4
- Prisma ORM 7
- PostgreSQL 17 (lokálne cez Docker Compose)

## Lokálne spustenie

Požiadavky: Node.js `20.19+`, `22.12+` alebo `24+`, npm a Docker.

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run db:setup
npm run dev
```

Aplikácia bude dostupná na [http://localhost:3000](http://localhost:3000). Úvodná URL presmeruje do administrácie.

Hlavné adresy:

- administrácia: [http://localhost:3000/admin](http://localhost:3000/admin)
- záujemcovia: [http://localhost:3000/admin/leady](http://localhost:3000/admin/leady)
- centrum spustenia: [http://localhost:3000/admin/spustenie](http://localhost:3000/admin/spustenie)
- demo landing page: [http://localhost:3000/kampan/servis](http://localhost:3000/kampan/servis)

## E-mailové notifikácie cez Resend

Po odoslaní formulára sa požiadavka najprv uloží do databázy a následne sa na
nastavené admin adresy odošle e-mailová notifikácia. Ak Resend dočasne zlyhá,
kontakt zostane bezpečne uložený v administrácii a databázový outbox ho skúsi
znova. V hostingu spúšťajte každých 5 minút `POST /api/email-outbox` s hlavičkou
`Authorization: Bearer <CRON_SECRET>`. Stav a manuálny retry sú v detaile leadu.

Ak záujemca vo formulári uvedie e-mail, dostane naň samostatné potvrdenie s
rekapituláciou požiadavky. Toto potvrdenie sa posiela nezávisle od zapnutých
admin príjemcov.

Do lokálneho `.env` a do environment premenných hostingu nastavte tajomstvá a prvotné fallbacky:

```bash
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="SAMBIKE <leady@send.sambike.sk>"
LEAD_NOTIFICATION_EMAILS="sambike.snv@gmail.com,vas.email@example.com"
APP_URL="https://vasa-domena.sk"
NEXT_PUBLIC_META_PIXEL_ID="123456789012345"
```

Adresy v `LEAD_NOTIFICATION_EMAILS` oddeľte čiarkou. Notifikácia príde na každú
aktívnu adresu. Po nasadení sa jednotliví príjemcovia zapínajú a vypínajú v
`Administrácia → Centrum spustenia`, bez ďalšej zmeny env premenných. Databázový
zoznam má po prvom uložení prednosť. Pôvodná premenná
`LEAD_NOTIFICATION_EMAIL` s jednou adresou zostáva podporovaná.

Pre prvý test môžete ako odosielateľa použiť
`SAMBIKE <onboarding@resend.dev>`. Táto testovacia doména posiela iba na e-mail
vlastníka Resend účtu. Ak má notifikáciu dostať aj ďalší príjemca, pridajte v
Resend vlastnú doménu, vložte
zobrazené SPF a DKIM záznamy do DNS a počkajte na stav `Verified`. Potom použite
ľubovoľnú adresu na overenej doméne ako `RESEND_FROM_EMAIL`.

`NEXT_PUBLIC_META_PIXEL_ID` je voliteľné. Ak zostane prázdne, landing page funguje
bez Meta Pixelu; interné udalosti a UTM atribúcia sa naďalej zachytávajú. Po
nastavení ID sa meranie samostatne zapína alebo vypína v
`Administrácia → Nastavenia → Meta reklamy`. Pred prvým zapnutím zostáva Pixel
vypnutý a aj po zapnutí sa načíta iba návštevníkom, ktorí povolili marketingové
cookies.

## Cloudflare R2 pre fotografie a videá

V produkcii nastavte `CAMPAIGN_MEDIA_STORAGE="r2"` a všetky premenné `R2_*`
uvedené v `.env.example`. Všetky fotografie aj videá sa nahrávajú priamo z
prehliadača cez krátkodobú podpísanú URL, aby ich neblokoval limit veľkosti
požiadavky hostingu. Súbory sa ukladajú v pôvodnej kvalite bez kompresie alebo
prekódovania (fotografie do 50 MB, MP4 videá do 500 MB).

V nastavení R2 bucketu povoľte CORS pre produkčnú doménu:

```json
[
  {
    "AllowedOrigins": ["https://sambike.webkastart.sk"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Ak sa produkčná doména zmení, upravte rovnakým spôsobom aj `AllowedOrigins`.

## Facebook a Instagram reklamy

Administrácia vie pri každej internej kampani vytvoriť kompletnú Meta reklamu,
nastaviť Facebook/Instagram, denný rozpočet, lokálny okruh, vek a termín. Nová
reklama sa vždy vytvorí ako pozastavená. Samostatné tlačidlo ju následne spustí,
pozastaví alebo načíta aktuálne výdavky, zobrazenia, kliknutia a Meta leady.

Prvá verzia je určená pre jeden SAMBIKE Business a reklamný účet. V Meta Business
Manageri vytvorte systémového používateľa, prideľte mu reklamný účet a stránku a
vygenerujte serverový token s oprávnením `ads_management`. V hostingu nastavte:

```bash
META_ACCESS_TOKEN="serverovy-token"
META_APP_SECRET="app-secret"
META_AD_ACCOUNT_ID="act_123456789012345"
META_PAGE_ID="123456789012345"
META_INSTAGRAM_ACTOR_ID="123456789012345"
META_API_VERSION="v25.0"
META_DEFAULT_LATITUDE="48.9446"
META_DEFAULT_LONGITUDE="20.5615"
```

`META_INSTAGRAM_ACTOR_ID` je voliteľné; bez neho zostáva dostupný Facebook.
`META_APP_SECRET` je tiež voliteľný, ale odporúčaný, pretože serverové volania
podpisuje pomocou `appsecret_proof`. `APP_URL` musí byť verejná HTTPS adresa –
Meta potrebuje načítať landing page aj obrázok reklamy. Po nastavení použite
`Administrácia → Centrum spustenia → Meta Business → Overiť Meta spojenie`.

Token ani app secret nikdy nepoužívajú prefix `NEXT_PUBLIC_` a neposielajú
sa do prehliadača.

Predvolený režim je `META_MODE="sandbox"`. Sandbox vytvorí iba lokálny
pozastavený koncept a nikdy nevytvorí ani nespustí reálnu reklamu. Pre live
režim treba vedome nastaviť `META_MODE="live"`, limity
`META_MAX_CAMPAIGN_DAILY_BUDGET_CENTS` a `META_MAX_GLOBAL_DAILY_BUDGET_CENTS`
a následne v administrácii znovu overiť konkrétny účet. Aktivácia vyžaduje EUR,
publikovanú landing page, čerstvé overenie nie staršie ako 24 hodín a explicitné
potvrdenie. Limity možno následne meniť ako netajné hodnoty v Centre spustenia;
databázové hodnoty majú prednosť pred env fallbackom a server ich vynucuje pri
vytvorení, zmene rozpočtu aj aktivácii. Karty a fakturácia zostávajú
výhradne v Meta Ads Manageri.

## Centrum spustenia

`/admin/spustenie` zjednocuje funkčné kontroly kampane, GDPR, formulára,
EmailOutboxu, Meta Pixelu, Meta Business a infraštruktúry. Bez úpravy kódu sa
tu spravujú netajné firemné/GDPR údaje, príjemcovia, verejné Pixel/Dataset ID a
rozpočtové limity. Zmeny sa auditujú iba zoznamom názvov polí; hodnoty ani
tajomstvá sa do auditu nekopírujú.

Tajomstvá (`*_SECRET`, API tokeny, databázové pripojenie, R2 a Sentry token)
zostávajú výhradne v hostingu. Centrum zobrazuje iba ich stav. Pixel ID,
`PRIVACY_*`, `LEAD_RETENTION_DAYS`, príjemcovia a rozpočtové env premenné sú
fallbacky pre prvé nasadenie; platná databázová hodnota má prednosť.

Test leadu vytvorí syntetický záznam označený `TEST` a EmailOutbox v jednej
autorizovanej admin ceste. Verejný formulár tým nezíska žiadny bypass. Testovací
e-mail aj retry používajú existujúci EmailOutbox. TEST lead možno v jeho detaile
anonymizovať. Každý autorizovaný cron zapisuje posledný pokus, úspech alebo
zlyhanie do `CronHealth`; centrum upozorní na chýbajúci alebo zastaraný beh.

Synchronizácia ukladá aj denné Meta spend, impressions, clicks a Meta leady.
Manuálne tlačidlo na detaile kampane zostáva dostupné. Pre pravidelný import
naplánujte raz denne `POST /api/cron/meta-sync` s hlavičkou
`Authorization: Bearer <CRON_SECRET>`. Interné leady uložené v Sambike Ads sú
samostatná metrika a nikdy sa nezamieňajú s `metaLeads`.

Dashboard počíta CPL ako Meta spend / interné leady, cenu zákazky ako Meta spend
/ dokončené zákazky a ROAS ako tržba dokončených zákaziek / Meta spend. Ak
niektorý vstup chýba alebo je deliteľ nulový, zobrazí `—`.

## Publikovanie, preview a A/B experimenty

Kampaň prechádza stavmi koncept, pripravená, publikovaná, pozastavená a
archivovaná. Verejná URL funguje iba pre `PUBLISHED`. Publikovanie vždy zopakuje
serverovú kontrolu pripravenosti a uloží nemenný snapshot; starú verziu možno
obnoviť iba do konceptu. Náhľad používa 15-minútový podpísaný odkaz
(`CAMPAIGN_PREVIEW_SECRET`), má `noindex` a nevytvára analytiku, lead ani e-mail.

Plánované časy sa zadávajú v `Europe/Bratislava`. Spúšťajte každú minútu
`POST /api/cron/campaigns` s hlavičkou `Authorization: Bearer <CRON_SECRET>`.
Cron je idempotentný, pred publikovaním opakuje kontrolu pripravenosti a pri
ukončení najprv pozastaví aktívnu Meta reklamu. A/B experiment podporuje jeden
variant B pre hero nadpis, popis, CTA a obrázok; variant sa uloží pri udalosti aj
leade a výsledky malej vzorky administrácia označí ako orientačné.

## Demo dáta

Seed vloží servisnú kampaň, jednu neaktívnu testovaciu kampaň a dvoch ukážkových záujemcov iba do úplne novej databázy. Je bezpečné ho spustiť opakovane; existujúce produkčné dáta nikdy neprepíše.

```bash
npm run db:seed
```

## Databáza

Lokálny PostgreSQL beží cez `docker-compose.yml`; dáta ostávajú v pomenovanom
Docker volume. Schéma je v `prisma/schema.prisma`, PostgreSQL migrácie v
`prisma/migrations/` a pôvodné SQLite migrácie sú zachované iba na audit v
`prisma/legacy-sqlite-migrations/`.

Užitočné príkazy:

```bash
npm run db:migrate -- --name nazov-zmeny
npm run db:generate
npm run db:studio
```

V produkcii používajte výhradne `npx prisma migrate deploy`. Existujúci `dev.db`
sa automaticky nemaže ani nekonvertuje; bezpečný read-only import spustíte až po
zálohe cez `SQLITE_SOURCE_PATH=./dev.db npm run db:import-sqlite`. Podrobný postup,
zálohy a restore checklist sú v [produkčnej dokumentácii](docs/production-deployment.md).

## Bezpečnosť, antispam a GDPR

Administrácia používa jeden podpísaný, expirovateľný `httpOnly` session cookie.
V produkcii sú povinné silné a navzájom odlišné `ADMIN_PASSWORD`,
`ADMIN_SESSION_SECRET` a `LEAD_PROTECTION_SECRET`; chýbajúce alebo ukážkové
hodnoty spôsobia jasnú konfiguračnú chybu. Všetky admin mutácie a upload API
overujú session aj na serveri.

Verejný formulár používa Zod validáciu, podpísaný časový token, honeypot,
PostgreSQL rate limit, deduplikáciu a Cloudflare Turnstile. Turnstile môže byť
lokálne vypnutý, ale v produkcii musia byť nastavené oba `TURNSTILE_*` kľúče.
Retenciu a údaje prevádzkovateľa spravuje Centrum spustenia; príslušné env
premenné zostávajú fallbackom. Meta Pixel sa načíta iba po marketingovom súhlase, ktorý je
možné na landing page zmeniť.

## CRM a interný funnel

Lead prechádza typovanými stavmi `NEW`, `CONTACTED`, `BOOKED`, `COMPLETED`,
`LOST` a `SPAM`. Každá zmena stavu, interná poznámka, follow-up, zodpovedná
osoba, retry e-mailu a anonymizácia vytvára append-only `LeadActivity`. Hodnota
dokončenej zákazky je uložená v celých centoch.

Zoznam leadov má serverové vyhľadávanie, filtre, triedenie, stránkovanie, počty
podľa stavov a CSV export s UTF-8 BOM, slovenským oddeľovačom a ochranou proti
formula injection. Verejné landing pages ukladajú validované `PAGE_VIEW`,
`CTA_CLICK`, `PHONE_CLICK` a `FORM_START`; `LEAD_CREATED` vzniká iba na serveri
po úspešnom uložení leadu. Počty sú udalosti, nie unikátni používatelia.

## Monitoring

Sentry je lokálne voliteľné. Pre server nastavte `SENTRY_DSN`, pre klienta
`NEXT_PUBLIC_SENTRY_DSN`; sourcemapy pri builde vyžadujú `SENTRY_AUTH_TOKEN`,
`SENTRY_ORG` a `SENTRY_PROJECT`. Integrácia odstraňuje cookies, authorization,
request body, query string a user údaje a nevytvára konzolové breadcrumbs.

## Funkcie MVP

- vytvorenie, úprava, aktivácia/deaktivácia a vymazanie kampane
- dynamická verejná URL `/kampan/[slug]`
- univerzálna responzívna landing page s hero obsahom, cenou, CTA a telefonickým kontaktom
- formulár pre záujemcov so súhlasom, potvrdením po odoslaní a väzbou na kampaň
- funnel dashboard s filtrom obdobia, tržbou, CPL, cenou zákazky a ROAS
- serverovo filtrovaný a stránkovaný CRM zoznam, CSV export a pracovný detail leadu
- interné meranie kampaní a denné historické Meta metriky
- samostatné fotografie pre úvod, ponuku a tri pozície v galérii; každá sa dá nahrať alebo nastaviť URL adresou
- vytvorenie, spustenie, pozastavenie a synchronizácia Facebook/Instagram reklamy cez Meta Marketing API
- ochrana administrácie heslom v produkcii

## Štruktúra

```text
app/
├── actions.ts                 # kampane a verejný lead formulár
├── crm-actions.ts             # autorizované CRM mutácie
├── admin/
│   ├── kampane/[id]/          # úprava kampane
│   ├── kampane/nova/          # vytvorenie kampane
│   ├── leady/[id]/            # detail záujemcu
│   └── leady/                 # zoznam a filtrovanie záujemcov
└── kampan/[slug]/             # univerzálna verejná landing page
components/                    # formuláre, navigácia a spoločné UI
generated/prisma/              # generovaný Prisma klient (po npm install)
lib/                           # databázový klient a utility
prisma/
├── migrations/                # verzované PostgreSQL migrácie
├── legacy-sqlite-migrations/  # historické migrácie, nespúšťať na PostgreSQL
├── schema.prisma              # databázový model
└── seed.ts                    # demo dáta
public/                        # statické aktíva
```

## Produkčné hranice

Nasadenie je určené jednej firme a jednému spoločnému administrátorskému účtu.
Produkcia vyžaduje PostgreSQL, trvalé R2 úložisko, HTTPS, Turnstile, pravidelný
outbox cron a reálne údaje prevádzkovateľa. Zálohy a externé služby musí vlastník
zapnúť a overiť podľa deployment checklistu.
