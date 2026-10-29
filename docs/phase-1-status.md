# Phase 1 — završni izvještaj, 23.10.2026.

## Isporučeno

Aktivni LensOS je React/TypeScript + Express/TypeScript aplikacija sa stvarnim PostgreSQL/Prisma backendom. Interfejs je na bosanskom, cijene su BAM/KM, a poslovni datumi su vezani za Sarajevo. Postojeće café stranice/CSS su iskorištene i poboljšane. Legacy SQLite baza i izvorni kod su sačuvani i odvojeni od aktivnog servera.

Vlasnička prijava koristi bcrypt i hashirane sesije. Dostupni su artikli/kategorije, pretraga/filter/sortiranje, aktivacija/deaktivacija, minimalne količine, napomene, dobavljač, datum zadnje nabavke, historija, korekcije s razlogom, nabavke s brojem fakture i historijskim jediničnim cijenama, dnevna prodaja s datumskim filterima, atomsko skidanje zaliha i dashboard. Zalihe ne mogu biti negativne. Stare prodajne cijene se ne prepisuju.

Stock komande imaju idempotency ključ. Ponovljeni i istovremeni zahtjevi ne dovode do dvostrukog skidanja. Audit čuva autora, vrijeme i podatke promjene. Upozorenja o zalihama se računaju dinamički. Demo, stvarni razvoj i testovi imaju odvojene PostgreSQL baze.

## Baza

Primijenjena je `202610230001_phase_one` migracija. Dvanaest poslovnih tabela: users, sessions, inventory_categories, suppliers, inventory_items, purchases, purchase_items, sales, sale_items, inventory_movements, audit_logs, commands. Prisma zasebno vodi svoju migracijsku historiju. Novac je NUMERIC(16,2), količine NUMERIC(16,3). FK i CHECK ograničenja štite historiju, iznose i balans kretanja.

## Izvršene provjere

| Provjera | Rezultat |
| --- | --- |
| TypeScript: frontend i backend | Prošlo |
| Vite production build | Prošlo |
| Postojeći regresijski/unit testovi | 50/50 |
| Nova PostgreSQL integracijska provjera | 19/19 |
| Playwright/Edge: prijava, artikal, nabavka, prodaja, historija, mobilni prikaz i fokus | 1/1 |
| Prisma generate i migrate status | Prošlo; baza ažurna |
| Frontend i API health | HTTP 200; PostgreSQL povezan |
| npm audit --omit=dev | 0 prijavljenih ranjivosti |

Testovi su izvršeni i nakon kompatibilnih zakrpa zavisnosti. Screenshotovi desktop/mobilnog prikaza su lokalno u `.local/screenshots`. Integration i browser testovi koriste nove sheme unutar `_test` baze i uklanjaju ih, bez pisanja u demo ili stvarne podatke.

## Sigurnosne napomene i ograničenja

Kompatibilne zakrpe uklonile su prijavljene produkcijske advisories. Prisma config CLI ima uski `deepmerge-ts=8.0.2` override zbog [prijavljenog problema s rekurzivnim grafovima](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). Prisma u ovom projektu spaja običnu statičnu konfiguraciju; generisanje klijenta, migracije i integracijski testovi su ponovljeni s tim overrideom. Ukloniti ga nakon buduće provjerene nadogradnje Prisma CLI-ja koja uključuje zakrpu.

Puni audit i dalje prijavljuje pet problema razvojnih/legacy alata: jedan high (brace-expansion) i četiri moderate (Vitest lanac i stari Electron wrapper). Electron nije dio aktivnog web servera. Za ove alate ostaje planirano zasebno ažuriranje; produkcijski audit je čist. Ne postoji tvrdnja o nezavisnoj sigurnosnoj certifikaciji.

Aplikacija trenutno radi lokalno u demo načinu. Za stvarni udaljeni rad potrebni su odvojena stvarna baza, HTTPS reverse proxy, odgovarajuće DB ovlasti i operativni backup raspored. Upute za backup i probni oporavak su u `operations.md`; backup automatizacija i probni povrat nisu izvršeni u ovoj fazi. Liste su ograničene na 1.000 zapisa, prodaje na 5.000 po periodu uz upozorenje. Finansijski dokumenti nemaju naknadno uređivanje/storno UI; takav audited reversal tok još nije dodat.

Recepti, otpis/popis, zaposleni, QR projekat, rashodi, grafikoni, izvozi i javni sajt ostaju za naredne faze. Phase 2 nije započeta. Ponovno pokretanje i sve komande navedeni su u README-u.
