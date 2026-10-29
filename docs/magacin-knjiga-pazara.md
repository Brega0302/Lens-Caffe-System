# Magacin i knjiga pazara

## Kako koristiti

1. U **Magacinu → Dodaj artikal** unesite naziv, jedinicu, kategoriju, minimalnu zalihu i cijene. Označite da li se artikal prodaje. Higijenu, čaše, potrošni materijal i slične artikle ostavite bez oznake prodaje.
2. **Dodaj zalihu / Nabavke** evidentira prijem robe i nabavnu cijenu. Roba se povećava samo u magacinu.
3. U **Izdavanju robe → Izdaj robu** odaberite artikle i količine koje nosite u lokal. Jedna potvrda smanjuje magacin, povećava stanje u kafiću i dopunjava tekuću smjenu u knjizi. Prodajna roba je u knjizi automatski razvrstana po kategoriji i nazivu; potrošni materijal ne ulazi u pazar.
4. **Knjiga pazara** počinje stanjem preostalim u kafiću. Na predaji prve smjene fizički prebrojite svaki artikal i unesite preostale količine, uključujući nule. **Spremi unos** čuva pripremu, a **Potvrdi predaju prve smjene** knjiži prodaju.
5. Dopune nakon prve predaje pripadaju drugoj smjeni. Na kraju dana unesite završno stanje i potvrdite **Zaključi dan i pazar**. Sljedeća knjiga preuzima tu preostalu robu.
6. U zaglavlju aplikacije i na pregledu vidi se **Naručiti** kada je magacinska zaliha na minimumu ili je nema. Provjera se osvježava nakon promjene, pri povratku u aplikaciju i svakih 60 sekundi. Obavijest je u aplikaciji, bez emaila ili SMS-a.

Primjer:

| Korak | Magacin | Kafić | Obračun |
| --- | ---: | ---: | --- |
| Nabavka 10 boca | 10 | 0 | Nabavka, bez prodaje |
| Izdano 6 boca | 4 | 6 | Dopuna I +6 |
| Predaja I: preostale 2 | 4 | 2 | Prodano 4 × 2,50 = 10,00 KM |
| Dopuna II: 2 boce | 2 | 4 | Dopuna II +2 |
| Kraj dana: preostala 1 | 2 | 1 | Prodano 3 × 2,50 = 7,50 KM |
| Ukupno | 2 | 1 | 7 prodanih, pazar 17,50 KM |

Ako je procijenjena nabavna cijena 1,20 KM, procijenjena bruto zarada za sedam boca je 9,10 KM. Plata, kirija, porezi i drugi rashodi nisu obuhvaćeni. Količine se mogu voditi s tri decimale, ali jedinica mora biti ista pri prijemu, izdavanju i prebrojavanju. Pretvaranje kutija u boce i recepti još nisu automatski uvedeni.

## Pravila obračuna

Prva smjena: početno + dopuna I − predaja I = prodano I.

Druga smjena: predaja I + dopuna II − završno stanje = prodano II.

Svaka razlika računa se kao prodaja. Prije potvrde provjerite stvarno stanje i eventualni manjak, oštećenje ili pogrešan unos. Ova verzija još nema poseban otpis robe iz kafića niti storniranje zaključene smjene. Magacinska korekcija s obaveznim razlogom i dalje postoji, ali ne mijenja stanje u kafiću.

Prebrojano stanje veće od zaduženja nije dozvoljeno; prvo ispravno evidentirajte dopunu. Svaka smjena zahtijeva stanje svih artikala. Zaključene smjene su nepromjenjive. Ručno knjiženje pojedinačnih prodaja preko starog POST /api/sales je isključeno da ne bi došlo do dvostrukog obračuna. Historija starih prodaja ostaje dostupna.

Dok traje otvorena smjena, kolona stanja u kafiću predstavlja zaduženje nakon prethodne predaje i novih dopuna. Stvarno preostalo stanje postaje potvrđeno nakon fizičkog prebrojavanja. Sistem ne zna prodaju uživo između dva brojanja.

Nabavna procjena magacina računa se ponderisano kroz nove nabavke. Izdavanje prenosi tu procjenu u kafić, a dopune se ponderišu s preostalom robom. Prva i druga smjena čuvaju zasebnu procjenu troška; svaka knjiga čuva prodajnu cijenu tokom dana. Promjena kataloške cijene važi za novu knjigu, bez prepisivanja prethodne. Ako nabavna vrijednost nije poznata, bruto zarada se ne izmišlja nego prikazuje kao nepoznata.

## Baza i sigurnost

Migracija `202610230002_warehouse_ledger` dodaje zasebno café stanje, procijenjene troškove, oznaku prodajnog artikla, ledger_days, ledger_lines, stock_transfers i transfer_items. Postojeća količina ostaje u magacinu; café stanje počinje nulom. Prodajni artikli se pri migraciji prepoznaju po ranijoj pozitivnoj prodajnoj cijeni. Stara roba s poznatom nabavkom dobija početnu procjenu iz posljednje nabavne cijene, što nije retroaktivni FIFO obračun. Vlasnik može provjeriti i ispraviti klasifikaciju u magacinu.

PostgreSQL enum vrijednosti se prvo dodaju u vlastitoj potvrđenoj transakciji; potom se ostale izmjene primjenjuju zajedno. Ograničenja štite pozitivna stanja, balans oba kretanja pri prijenosu i samo jednu otvorenu knjigu. Izdavanje i zaključivanje su serializable transakcije s idempotency ključem. Verzija knjige sprječava potvrdu zastarjelog brojanja ako je neko u međuvremenu izdao novu robu. Svako izdavanje, otvaranje, spremanje unosa i zaključivanje ima audit zapis i odgovornog korisnika.

Aktivni endpointi: GET /api/ledger?date=YYYY-MM-DD, POST /api/ledger/open, POST /api/ledger/:id/draft, POST /api/ledger/:id/close, GET/POST /api/stock-transfers. Mutacije zahtijevaju postojeću vlasničku/menadžersku dozvolu i Idempotency-Key. Posebna knjiga/pristup za konobare nije uvedena u ovoj nadogradnji.

Provjere: 20 PostgreSQL testova za prijem, prijenos, ponavljanje, konkurentnost, obje smjene, cijene, nepoznati trošak, noćni prijenos stanja, upozorenja i dozvole; 50 regresijskih testova; browser tok s magacinom, dvije smjene i mobilnim prikazom. Pokretanje: `npm run db:migrate`, `npm run dev:web`. Lozinka postojećeg demo korisnika nije promijenjena.
