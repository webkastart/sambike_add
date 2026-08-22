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
`sambike.snv@gmail.com` odošle e-mailová notifikácia. Ak Resend dočasne zlyhá,
kontakt zostane bezpečne uložený v administrácii.

Do lokálneho `.env` a do environment premenných hostingu nastavte:

```bash
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="SAMBIKE <leady@send.sambike.sk>"
LEAD_NOTIFICATION_EMAIL="sambike.snv@gmail.com"
APP_URL="https://vasa-domena.sk"
NEXT_PUBLIC_META_PIXEL_ID="123456789012345"
```

Pre prvý test môžete ako odosielateľa použiť
`SAMBIKE <onboarding@resend.dev>`. Táto testovacia doména posiela iba na e-mail
vlastníka Resend účtu. Pre produkciu pridajte v Resend vlastnú doménu, vložte
zobrazené SPF a DKIM záznamy do DNS a počkajte na stav `Verified`. Potom použite
ľubovoľnú adresu na overenej doméne ako `RESEND_FROM_EMAIL`.

`NEXT_PUBLIC_META_PIXEL_ID` je voliteľné. Ak zostane prázdne, landing page funguje
bez Meta Pixelu; interné udalosti a UTM atribúcia sa naďalej zachytávajú.

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
- demo obsah a obrázky, ktoré sa dajú v administrácii nahradiť URL adresou

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

Administrácia zámerne nemá autentifikáciu. Obrázok kampane sa zatiaľ nastavuje URL adresou, nie uploadom. Pred nasadením na verejný server treba doplniť prihlásenie, ochranu formulára proti spamu, produkčnú databázu a pravidlá uchovávania osobných údajov.
