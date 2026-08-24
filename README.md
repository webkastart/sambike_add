# SAMBIKE Ads

Lokálne MVP pre správu reklamných kampaní a dynamických landing pages pre požičovňu bicyklov. Každá kampaň používa rovnakú responzívnu šablónu a vlastné dáta podľa slug-u.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4
- Prisma ORM 7
- SQLite

## Lokálne spustenie

Požiadavky: Node.js `20.19+`, `22.12+` alebo `24+` a npm.

```bash
npm install
cp .env.example .env
npm run db:setup
npm run dev
```

Aplikácia bude dostupná na [http://localhost:3000](http://localhost:3000). Úvodná URL presmeruje do administrácie.

Hlavné adresy:

- administrácia: [http://localhost:3000/admin](http://localhost:3000/admin)
- záujemcovia: [http://localhost:3000/admin/leady](http://localhost:3000/admin/leady)
- demo landing page: [http://localhost:3000/kampan/pozicovna](http://localhost:3000/kampan/pozicovna)

## E-mailové notifikácie cez Resend

Po odoslaní formulára sa požiadavka najprv uloží do databázy a následne sa na
nastavené admin adresy odošle e-mailová notifikácia. Ak Resend dočasne zlyhá,
kontakt zostane bezpečne uložený v administrácii.

Ak záujemca vo formulári uvedie e-mail, dostane naň samostatné potvrdenie s
rekapituláciou požiadavky. Toto potvrdenie sa posiela nezávisle od zapnutých
admin príjemcov.

Do lokálneho `.env` a do environment premenných hostingu nastavte:

```bash
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="SAMBIKE <leady@send.sambike.sk>"
LEAD_NOTIFICATION_EMAILS="sambike.snv@gmail.com,vas.email@example.com"
APP_URL="https://vasa-domena.sk"
NEXT_PUBLIC_META_PIXEL_ID="123456789012345"
ADMIN_PASSWORD="dlhe-jedinecne-heslo"
```

Adresy v `LEAD_NOTIFICATION_EMAILS` oddeľte čiarkou. Notifikácia príde na každú
aktívnu adresu. Po nasadení sa jednotliví príjemcovia zapínajú a vypínajú v
`Administrácia → Nastavenia`, bez ďalšej zmeny env premenných. Pôvodná premenná
`LEAD_NOTIFICATION_EMAIL` s jednou adresou zostáva podporovaná.

Pre prvý test môžete ako odosielateľa použiť
`SAMBIKE <onboarding@resend.dev>`. Táto testovacia doména posiela iba na e-mail
vlastníka Resend účtu. Ak má notifikáciu dostať aj ďalší príjemca, pridajte v
Resend vlastnú doménu, vložte
zobrazené SPF a DKIM záznamy do DNS a počkajte na stav `Verified`. Potom použite
ľubovoľnú adresu na overenej doméne ako `RESEND_FROM_EMAIL`.

`NEXT_PUBLIC_META_PIXEL_ID` je voliteľné. Ak zostane prázdne, landing page funguje
bez Meta Pixelu; interné udalosti a UTM atribúcia sa naďalej zachytávajú.

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
`Administrácia → Nastavenia → Meta reklamy → Overiť spojenie s Meta`.

Token, app secret ani heslo nikdy nepoužívajú prefix `NEXT_PUBLIC_` a neposielajú
sa do prehliadača.

## Ochrana administrácie

V produkcii je `ADMIN_PASSWORD` povinné. Relácia je uložená v podpísanej,
`HttpOnly` a `SameSite=Lax` cookie s platnosťou 12 hodín. Voliteľné
`ADMIN_SESSION_SECRET` môže oddeliť podpis relácie od prihlasovacieho hesla.
Lokálny development zostáva bez hesla, pokiaľ `ADMIN_PASSWORD` nenastavíte.

## Demo dáta

Seed vloží štyri kampane (`pozicovna`, `servis`, `letna-akcia`, jednu neaktívnu) a troch ukážkových záujemcov iba do úplne novej databázy. Je bezpečné ho spustiť opakovane; existujúce produkčné dáta nikdy neprepíše.

```bash
npm run db:seed
```

## Databáza

Lokálna SQLite databáza vznikne ako `dev.db` v koreni projektu. Schéma je v `prisma/schema.prisma`, migrácie v `prisma/migrations/`.

Užitočné príkazy:

```bash
npm run db:migrate -- --name nazov-zmeny
npm run db:generate
npm run db:studio
```

## Funkcie MVP

- vytvorenie, úprava, aktivácia/deaktivácia a vymazanie kampane
- dynamická verejná URL `/kampan/[slug]`
- univerzálna responzívna landing page s hero obsahom, cenou, CTA a telefonickým kontaktom
- formulár pre záujemcov so súhlasom, potvrdením po odoslaní a väzbou na kampaň
- dashboard s počtom záujemcov a stavom kampaní
- zoznam, filtrovanie a detail záujemcov
- samostatné fotografie pre úvod, ponuku a tri pozície v galérii; každá sa dá nahrať alebo nastaviť URL adresou
- vytvorenie, spustenie, pozastavenie a synchronizácia Facebook/Instagram reklamy cez Meta Marketing API
- ochrana administrácie heslom v produkcii

## Štruktúra

```text
app/
├── actions.ts                 # serverové akcie pre kampane a záujemcov
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
├── migrations/                # verzované SQLite migrácie
├── schema.prisma              # databázový model
└── seed.ts                    # demo dáta
public/                        # statické aktíva
```

## Hranice MVP

Nahrané obrázky sa ukladajú lokálne do `storage/campaign-images`, preto treba pri
nasadení na serverless hosting použiť trvalé objektové úložisko. Jedno spoločné
admin heslo je vhodné pre malý interný tím; pri viacerých firmách alebo rolách ho
treba nahradiť používateľskými účtami. Pred verejným nasadením treba doplniť aj
ochranu formulára proti spamu, produkčnú databázu a pravidlá uchovávania osobných
údajov.
