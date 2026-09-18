# Produkčné nasadenie a obnova

## PostgreSQL a migrácie

1. Vytvorte samostatnú PostgreSQL databázu a používateľa s TLS pripojením.
2. Nastavte produkčný `DATABASE_URL`; nepoužívajte údaje z `docker-compose.yml`.
3. Pred nasadením aplikácie spustite `npx prisma migrate deploy` ako jednorazový release krok.
4. Seed v produkcii spúšťajte iba na vedome prázdnej databáze. Je idempotentný a pri existujúcej kampani nič nemení.
5. Nikdy nepoužívajte `prisma migrate reset` ani nemažte pôvodný SQLite súbor pri migrácii.

### Import existujúceho SQLite

1. Zastavte zápisy do starej aplikácie a vytvorte kópiu `dev.db` aj prípadných `-wal`/`-shm` súborov.
2. Na čistom PostgreSQL spustite `npx prisma migrate deploy`.
3. Nastavte `DATABASE_URL` na PostgreSQL a `SQLITE_SOURCE_PATH` na kópiu SQLite.
4. Spustite `npm run db:import-sqlite`. Import číta SQLite iba v read-only režime, používa pôvodné ID a existujúce cieľové riadky neprepisuje.
5. Porovnajte počty kampaní, leadov, galérie a Meta reklám v oboch databázach a manuálne skontrolujte niekoľko záznamov.
6. Až po akceptácii prepnite aplikáciu. Pôvodnú databázu uchovajte počas dohodnutej rollback lehoty.

Import historickým leadom priradí čas súhlasu podľa `createdAt` a verziu `legacy-import-2026-09`. Staré leady nevkladá do e-mailového outboxu, takže import neposiela zákazníkom nové správy.

## Povinný hosting checklist

- Nastavte všetky hodnoty z `.env.example`; najmä jedinečné `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `LEAD_PROTECTION_SECRET` a `CRON_SECRET`.
- Vyplňte reálne `PRIVACY_OPERATOR_NAME`, `PRIVACY_OPERATOR_ADDRESS`, `PRIVACY_CONTACT_EMAIL`, verziu zásad a retenciu. Aplikácia nevymýšľa právne údaje.
- V Cloudflare Turnstile vytvorte widget pre produkčné hostname a nastavte verejný aj tajný kľúč.
- V R2 nastavte credentials a CORS `PUT` iba pre produkčný origin.
- V Resend overte odosielaciu doménu a DNS SPF/DKIM, potom nastavte API kľúč, odosielateľa a príjemcov.
- Volajte `POST /api/email-outbox` s `Authorization: Bearer <CRON_SECRET>` každých 5 minút. Volanie musí používať HTTPS a nesmie logovať token.
- Ak sa používajú Meta reklamy, volajte `POST /api/cron/meta-sync` rovnakým spôsobom podľa požadovanej frekvencie (napríklad raz za hodinu).
- Ak sa používa Meta Pixel, nastavte číselné `NEXT_PUBLIC_META_PIXEL_ID`, aplikáciu znovu nasaďte a meranie vedome zapnite v `Administrácia → Nastavenia → Meta reklamy`.
- Nastavte Sentry DSN; pre sourcemapy nastavte aj auth token, organizáciu a projekt. Overte testovaciu serverovú aj klientsku chybu bez osobných údajov.
- Overte, že `/admin` bez cookie presmeruje na `/prihlasenie`, odpovede admina majú `no-store` a `noindex`, HSTS sa posiela iba cez produkčné HTTPS.

## Zálohy a obnova

Repozitár sám zálohy nevytvára, pretože nevie, ktorý PostgreSQL provider bude použitý. V providerovi povinne zapnite:

- automatickú dennú zálohu alebo point-in-time recovery,
- retenciu aspoň 30 dní (alebo dlhšiu podľa interných požiadaviek),
- šifrovanie a oddelenie prístupov od aplikačného účtu,
- upozornenie na zlyhanie zálohy.

Ak provider spravované zálohy neposkytuje, naplánujte `pg_dump --format=custom --no-owner "$DATABASE_URL" --file sambike-YYYY-MM-DD.dump` na oddelenom zabezpečenom workerovi a výsledok ukladajte šifrovane mimo aplikačného hostingu. Heslo ani URL nevkladajte do príkazu uloženého v repozitári.

Obnovu skúšajte minimálne štvrťročne do novej, izolovanej databázy:

1. vytvorte prázdnu cieľovú databázu,
2. obnovte provider snapshot alebo použite `pg_restore --clean --if-exists --no-owner --dbname "$RESTORE_DATABASE_URL" backup.dump`,
3. spustite `npx prisma migrate deploy` proti obnovenej databáze,
4. porovnajte počty a manuálne overte kampane, leady a outbox,
5. zapíšte dátum, trvanie a výsledok testu obnovy.

## Retencia leadov

`LEAD_RETENTION_DAYS` definuje maximálnu retenčnú dobu (predvolene 730 dní). Vlastník musí naplánovať pravidelnú kontrolu a anonymizáciu expirovaných leadov v administrácii; automatické mazanie v tejto fáze nie je zapnuté, aby sa údaje neodstránili bez schváleného procesu.
