# LensOS — Caffe Lens

> **Work in progress — actively developing and improving.** This is an ongoing personal project for Caffe Lens. Features, design and workflows are still being refined; it is not a finished production release.

## Project overview

LensOS is a full-stack café management application built around day-to-day hospitality workflows. It connects warehouse stock, goods transferred to the café, purchasing and a two-shift daily sales ledger.

### Implemented features

- Owner authentication with bcrypt password hashing and hashed sessions.
- Inventory, categories, suppliers, purchase records and low-stock alerts.
- Warehouse-to-café transfers with transactional stock updates.
- Opening counts, first-shift handover and closing counts with sales calculations.
- Historical purchase/selling prices, estimated gross profit and an audit trail.
- A responsive Bosnian-language interface with BAM/KM amounts.

**Stack:** React, TypeScript, Vite, Node.js, Express, PostgreSQL and Prisma. The project includes Vitest, PostgreSQL integration tests and Playwright browser tests.

### In progress and planned

Further work includes a dedicated waiter workflow and permissions, inventory write-offs and corrections to posted financial documents, reporting/exports and deployment hardening. The separate QR menu is not yet integrated into this system. Current limitations and setup instructions are documented below and in `docs/`.

Development status: **ongoing**. The source includes earlier legacy modules retained during development; the active application is under `src/lensos` and `server/lensos`.

**Aktuelna nadogradnja:** odvojeni Magacin i Kafić, izdavanje robe i Knjiga pazara s prvom/drugom smjenom. [Upute za novi način rada](docs/magacin-knjiga-pazara.md). Prodaja se sada knjiži iz prebrojanih stanja; ranija historija je sačuvana. Posebna knjiga/prava za konobare dolaze kasnije.

Phase 1: trajna evidencija artikala, nabavki, dnevnih prodaja i kretanja zaliha. Interfejs je na bosanskom, valuta BAM/KM, vremenska zona Europe/Sarajevo.

## Tehnologije i struktura

- React 19, TypeScript, Vite, Tailwind i postojeći prilagođeni CSS; React Router.
- Node 22.17+, Express 5, Zod validacija, bcrypt i hashirane sesije.
- PostgreSQL i Prisma 6.19.3; decimalni novac NUMERIC(16,2), količine NUMERIC(16,3).
- `src/lensos`: aktivni TypeScript ekrani i tipovi; `src/api`: API klijent.
- `server/lensos`: TypeScript API, autorizacija, validacija i transakcijski servisi.
- `prisma/schema.prisma`: relacijski model; `prisma/migrations`: verzionirana migracija i DB ograničenja.
- `scripts`: lokalna PostgreSQL baza i odvojeni browser testovi.
- `docs`: arhitektura, API i backup/oporavak.

Stari QuattroDrive kontroleri, ekrani, SQLite fajl i game Socket.IO ostaju u izvornom kodu radi očuvanja ranijih podataka. Aktivni web server ih ne učitava. `npm run legacy:server` je samo ručno pokretanje starog servera na istom portu; ne pokretati ga zajedno s LensOS API-jem. PostgreSQL nema automatski uvezene stare ili miješane demo podatke.

## Brzo lokalno pokretanje na Windowsu

Potreban je instaliran PostgreSQL u `C:\Program Files\PostgreSQL`. U folderu projekta:

```powershell
npm ci
npm run db:local
npm run db:generate
npm run db:migrate
npm run seed:demo
npm run dev:web
```

Otvorite `http://127.0.0.1:5173`. API radi na `127.0.0.1:3001`; Vite prosljeđuje `/api` zahtjeve. Ako je port zauzet, naredba javlja grešku umjesto tihog prelaska na drugi port.

`db:local` stvara vlastiti PostgreSQL cluster u ignorisanom `.local/postgres` i koristi port 55432 samo na lokalnom računaru. Ne mijenja postojeću PostgreSQL instalaciju/baze. Generiše lozinku baze u `.local/postgres-password` i `.env`, bez prikazivanja u terminalu. `.env` se nikada ne prepisuje ako već postoji. Cluster nije automatski Windows servis: poslije restarta računara ponovo pokrenite `npm run db:local`.

Seed ispisuje generisanu lozinku korisnika `lens-demo-owner` samo prilikom prvog kreiranja. Sačuvajte je. Ponavljanje seeda ne mijenja lozinku ni postojeće podatke. Za izbor vlastite lozinke od najmanje 12 znakova prije prvog seeda postavite `LENSOS_OWNER_PASSWORD` lokalno. U kodu nema podrazumijevane lozinke.

## Odvajanje demo i stvarnog poslovanja

Postoje tri odvojene baze: `lensos_demo`, `lensos_dev`, `lensos_test`. Lokalni `.env` bira demo, a aplikacija prikazuje žutu DEMO oznaku. Sve što unesete u toj sesiji ostaje u demo bazi.

Za stvarnu praznu evidenciju podesite `DATABASE_URL` na vlastitu bazu, npr. `lensos_dev`, i `APP_MODE=production`, pa pokrenite:

```powershell
npm run db:migrate
npm run db:owner
npm run dev:web
```

`db:owner` stvara samo prvog vlasnika i ispisuje generisanu lozinku jednom. Demo seed je odbijen ako baza nema sufiks `_demo` ili je NODE_ENV=production. Ne koristi se za stvarnu bazu. Testovi odbijaju URL bez sufiksa `_test` i koriste nove sheme koje se na kraju brišu.

Za drugi PostgreSQL server kopirajte `.env.example` u `.env` i unesite vlastiti connection string. Lozinka u URL-u mora biti URL-enkodirana. `.env`, `.local`, dumpovi i baze su ignorisani u Gitu. Folder ovog projekta trenutno nema `.git`; historija i commitovi moraju biti inicijalizirani ili vraćeni iz originalnog repozitorija prije timskog rada.

## Varijable okruženja

| Varijabla | Namjena |
| --- | --- |
| `DATABASE_URL` | PostgreSQL baza aktivne aplikacije |
| `TEST_DATABASE_URL` | Posebna baza čije ime završava na `_test` |
| `APP_MODE` | `demo` za `_demo` bazu, `production` za stvarnu evidenciju |
| `PORT` | API port; podrazumijevano 3001 |
| `LENSOS_CORS_ORIGINS` | Dozvoljene frontend adrese, razdvojene zarezom |
| `LENSOS_OWNER_USERNAME` | Korisničko ime pri početnom kreiranju vlasnika |
| `LENSOS_OWNER_PASSWORD` | Neobavezna lokalna početna lozinka; inače se generiše |
| `PLAYWRIGHT_CHANNEL` | Browser za E2E; podrazumijevano instalirani `msedge` |

Poslovni datumi su namjerno vezani za Europe/Sarajevo, bez zavisnosti od vremenske zone računara. Današnje prodaje dobijaju stvarno vrijeme; naknadno uneseni raniji datumi bilježe se u 12:00 po sarajevskom vremenu i zadržavaju stvarni `createdAt` za audit.

## Poslovna pravila

- Kreiranje artikla počinje s nulom. Stanje se mijenja kroz nabavku ili korekciju uz obavezan razlog.
- Nabavka čuva vlastite jedinične cijene, broj računa i stavke. Kataloška nabavna cijena prati najnoviji datum nabavke; stariji račun je ne prepisuje.
- Prodaja čuva naziv i prodajnu cijenu kakvi su bili prilikom knjiženja. Aktivnost i dovoljna zaliha provjeravaju se na serveru.
- Prodaja, stavke, smanjenje zalihe, kretanje, audit i ključ zahtjeva su jedna serializable transakcija, s ponavljanjem pri konkurentnom konfliktu.
- Idempotency-Key štiti nabavke, prodaje i korekcije od dvostrukog knjiženja. Browser pamti isti ključ kroz gubitak odgovora i ponovno učitavanje.
- Historija se ne briše. Artikli se deaktiviraju; jedinica mjere s historijom se ne mijenja.
- Niske zalihe su aktivni artikli sa stanjem većim od nule i na/ispod minimuma. Nulta stanja se prikazuju zasebno. Upozorenja se računaju dinamički.
- Dashboard prikazuje prihod, količine, najprodavanije artikle i zalihe. Ne prikazuje prihod kao dobit. Cijena nabavke se snima na prodajnoj stavci samo ako postoji nabavka; napredna računica dobiti pripada kasnijoj fazi.

## Provjere

```powershell
npm run typecheck
npm run test:unit
npm run test:postgres
npm run test:e2e
npm run build
```

`test:unit` obuhvata 50 postojećih/frontend regresijskih testova, uključujući očuvani legacy kod. `test:postgres` provjerava novu implementaciju na stvarnom PostgreSQL-u: negativnu zalihu, rollback, simultane prodaje, idempotenciju, cijene, audit, dozvole, decimalno zaokruživanje i sarajevske datume. Test stvara i uklanja zasebnu shemu u `_test` bazi.

Playwright koristi instalirani Edge, posebne portove 3301/5175 i vlastitu shemu u `_test` bazi. Generiše privremenu lozinku i briše shemu poslije provjere. Za CI s Chromiumom instalirajte `npx playwright install chromium` i postavite `PLAYWRIGHT_CHANNEL=chromium`. Browser test provjerava prijavu → artikal → nabavka → prodaja → historija → mobilni prikaz. Screenshotovi su u `.local/screenshots`; izvještaj u `playwright-report`.

## Pokretanje builda

```powershell
npm run build
$env:NODE_ENV='production'
npm start
```

Produkcijski server servira `dist` i API s istog origina. Za ovo treba stvarna baza i APP_MODE=production; demo baza je odbijena. Node server je vezan za 127.0.0.1; za udaljeni pristup postavite HTTPS reverse proxy ispred njega. Koristite zasebnu PostgreSQL aplikacijsku ulogu s minimalnim ovlastima i migracijsku ulogu za deploy. Lokalni cluster/korisnik iz `db:local` namijenjen je razvoju.

## Ograničenja Phase 1

QR naručivanje, recepti, otpis, popis, rasporedi, administracija zaposlenika, rashodi, grafikoni i izvozi nisu dio ove faze. Ne postoji online naplata. Upozorenja nemaju inbox/označavanje pročitanim. Prodaje nemaju ekran za storniranje ili naknadne izmjene; finansijski dokumenti su nepromjenjivi kroz API. Proširenje ovlaštenih storna zahtijeva zaseban audited reversal tok.

Lista artikala/nabavki i historija ograničene su na 1.000 zapisa, a prodaja na 5.000 po periodu uz upozorenje da se period suzi. Dashboard koristi pune dnevne podatke. Za veći obim treba paginacija i serverska izvještajna agregacija. Sesije su u sessionStorage; produkcijska zaštita zahtijeva HTTPS i kontrolu XSS-a. Login rate limiting je po procesu; za više instanci treba zajednički store. Nije provedeno opterećenje, nezavisni sigurnosni pregled niti javni deployment.

Arhitektura i model: [docs/phase-1-architecture.md](docs/phase-1-architecture.md). API i backup: [docs/operations.md](docs/operations.md). Rezultati provjera i preostala ograničenja: [docs/phase-1-status.md](docs/phase-1-status.md).
