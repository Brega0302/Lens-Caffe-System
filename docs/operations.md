# LensOS: API, migracije i oporavak

## API

Svi poslovni endpointi zahtijevaju `Authorization: Bearer <session>`. Vlasnik/menadžer imaju Phase 1 operativne dozvole. EMPLOYEE trenutno nema dodijeljene ovlasti; administracija zaposlenika dolazi kasnije. Vlasnik dodatno može čitati audit.

| Metoda | Endpoint | Sadržaj |
| --- | --- | --- |
| POST | /api/auth/login | username, password; vraća token, expiresAt, user |
| POST | /api/auth/logout | Opoziv trenutne sesije |
| GET | /api/session | Korisnik i oznaka demo okruženja |
| GET | /api/inventory | search, categoryId, lowStock, sort, direction |
| GET | /api/inventory/:id | Artikal |
| POST | /api/inventory | name, unit, category, supplier, minimumQuantity, purchasePrice, sellingPrice, notes |
| PATCH | /api/inventory/:id | Isti kompletan oblik kao POST; nema currentQuantity |
| PATCH | /api/inventory/:id/status | active: boolean |
| GET | /api/inventory/:id/movements | Historija s korisnikom i vremenom |
| POST | /api/inventory/:id/adjustments | quantity (potpisan broj), note (obavezan), type=MANUAL_ADJUSTMENT |
| GET/POST | /api/purchases | purchaseDate, supplier, invoiceReference, note, items[{inventoryItemId, quantity, unitCost}] |
| GET | /api/purchases/:id | Nabavka i historijske cijene |
| GET/POST | /api/sales | GET: from/to; POST: saleDate ili soldAt, note, items[{inventoryItemId, quantity, sellingPrice?}] |
| GET | /api/sales/:id | Sačuvana prodaja |
| GET | /api/dashboard/summary | date (YYYY-MM-DD, zadano danas) |
| GET | /api/audit | Posljednjih 200 zapisa; samo OWNER |
| GET | /api/health | Provjera baze i API-ja |

POST za prodaju, nabavku ili korekciju zahtijeva jedinstveni `Idempotency-Key` od 16–80 znakova (UUID preporučen). Pri mrežnoj grešci ponovite potpuno isti zahtjev s istim ključem. Promjena tijela ili korisnika uz isti ključ daje 409. Uspješni replay vraća isti ID. Za novu namjernu transakciju koristite novi ključ. Dupli artikal u istom dokumentu je odbijen.

Novac se šalje kao decimalni string, npr. `"2.50"`, količine kao `"1.250"`. Server koristi Decimal, a DB ograničenja onemogućavaju negativne cijene/zalihe i neuravnotežena kretanja. Najviše 100 stavki po dokumentu. Datum bez vremena je YYYY-MM-DD; soldAt mora sadržati vremensku zonu/offset. Greške: 400 validacija, 401 prijava, 403 dozvola, 404 nepostojeći zapis, 409 zaliha/konflikt, 429 ograničenje zahtjeva.

## Migracije

Prva migracija stvara 12 povezanih tabela: users, sessions, inventory_categories, suppliers, inventory_items, purchases, purchase_items, sales, sale_items, inventory_movements, audit_logs i commands. Prisma dodatno održava svoju `_prisma_migrations` tabelu. SQL uključuje indekse, FK, jedinice mjere, pozitivne stavke, jednadžbe iznosa i balans kretanja.

Pokrenite `npm run db:generate` pa `npm run db:migrate`. Naredba koristi `prisma migrate deploy`; ne briše postojeće podatke niti seeduje automatski. Prije produkcijske migracije napravite i provjerite backup. Ne koristite migrate reset na stvarnoj bazi. Nova promjena sheme zahtijeva novu migraciju; ne mijenjajte već primijenjene SQL fajlove.

SQLite datoteka nije automatski migrirana. Prije eventualnog uvoza razdvojite stvarne/demo i legacy zapise, mapirajte korisnike, provjerite sume zaliha i cijene, uvezite u praznu staging bazu i usaglasite izvještaje. Nikad ne prepisujte izvornu datoteku tokom uvoza.

## Backup i provjera povrata

Za PostgreSQL koristite `pg_dump` iste ili novije glavne verzije od servera. Primjer (zamijenite host, port, ulogu i bazu vlastitim vrijednostima):

```powershell
pg_dump -h 127.0.0.1 -p 5432 -U lensos_backup -d lensos -W -Fc -f lensos-2026-10-23.dump
createdb -h 127.0.0.1 -p 5432 -U lensos_restore -W lensos_restore_check
pg_restore -h 127.0.0.1 -p 5432 -U lensos_restore -d lensos_restore_check -W --no-owner --no-acl lensos-2026-10-23.dump
```

`-W` traži lozinku interaktivno. Ne stavljajte lozinku u Git ili argument komandne linije. Za lokalni razvoj koristite port 55432 i ime lokalne baze.

Plan za stvarno poslovanje: automatski dnevni backup, više verzija, šifrovana kopija na drugoj lokaciji, obavijest o neuspjehu i mjesečna proba oporavka. Zabilježite dogovoreni maksimalni gubitak podataka i vrijeme oporavka. Po potrebi dodajte PostgreSQL WAL/PITR. Ova aplikacija dokumentuje postupak; backup raspored nije automatski postavljen.

Obnavljajte prvo u novu bazu. Provjerite migrate status, broj dokumenata, dnevni prihod, sumu stavki i balans kretanja prema trenutnim zalihama. Pokrenite aplikaciju nad obnovljenom bazom u izolovanom okruženju. Tek nakon provjere prebacite DATABASE_URL i sačuvajte prethodnu bazu. Ne koristite --clean nad aktivnom stvarnom bazom.
