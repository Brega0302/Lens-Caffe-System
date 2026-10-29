import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightLeft, BookOpen, Check, Save, RefreshCw } from "lucide-react";
import { api, asMoney, decimal, localToday, minor, write } from "../api/client";
import { errorMessage, units } from "./types";
import Modal from "./Modal";

type Line = {
  id: number;
  inventoryItemId: number;
  name: string;
  category: string | null;
  unit: string;
  opening: string;
  receivedFirst: string;
  receivedSecond: string;
  countFirst: string | null;
  countFinal: string | null;
  soldFirst: string | null;
  soldSecond: string | null;
  costFirst: string | null;
  costSecond: string | null;
  sellingPrice: string;
  revenueFirst: string;
  revenueSecond: string;
  costTotalFirst: string | null;
  costTotalSecond: string | null;
  sold: string;
  revenue: string;
  estimatedGross: string | null;
};
type Book = {
  id: number;
  date: string;
  stage: number;
  version: number;
  lines: Line[];
  totals: {
    first: string;
    second: string;
    revenue: string;
    cost: string | null;
    estimatedGross: string | null;
  };
};
const scaled = (value: string, digits = 3) => {
  const [whole, fraction = ""] = value.split(".");
  return (
    BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, "0"))
  );
};
const quantity = (value: bigint) => String(Number(value) / 1000);
const stageNames: Record<number, string> = {
  1: "Prva smjena otvorena",
  2: "Druga smjena otvorena",
  3: "Dan zaključen",
};
export default function LedgerPage() {
  const [date, setDate] = useState(localToday()),
    [book, setBook] = useState<Book | null>(null),
    [counts, setCounts] = useState<Record<number, string>>({}),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [note, setNote] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ data: Book | null }>(`/ledger?date=${date}`);
      setBook(result.data);
      setCounts(
        Object.fromEntries(
          (result.data?.lines || []).map((line) => [
            line.inventoryItemId,
            (result.data?.stage === 1 ? line.countFirst : line.countFinal) ??
              "",
          ]),
        ),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [date]);
  useEffect(() => {
    void load();
  }, [load]);
  const preview = useMemo(() => {
    let revenue = 0n,
      cost = 0n,
      known = true,
      complete = true,
      invalid = false;
    const rows = new Map<
      number,
      { sold: string; revenue: string; gross: string | null }
    >();
    if (!book || book.stage === 3)
      return {
        revenue: "0.00",
        gross: null,
        complete: false,
        invalid: false,
        rows,
      };
    for (const line of book.lines) {
      const text = counts[line.inventoryItemId] ?? "";
      if (!/^\d{1,9}(\.\d{1,3})?$/.test(text)) {
        complete = false;
        continue;
      }
      const available =
        book.stage === 1
          ? scaled(line.opening) + scaled(line.receivedFirst)
          : scaled(line.countFirst || "0") + scaled(line.receivedSecond);
      const sold = available - scaled(text);
      if (sold < 0n) {
        invalid = true;
        continue;
      }
      const total = (sold * minor(line.sellingPrice) + 500n) / 1000n;
      const unitCost = book.stage === 1 ? line.costFirst : line.costSecond;
      const lineCost =
        sold === 0n
          ? 0n
          : unitCost === null
            ? null
            : (sold * scaled(unitCost, 6) + 5000000n) / 10000000n;
      revenue += total;
      if (lineCost === null) known = false;
      else cost += lineCost;
      rows.set(line.inventoryItemId, {
        sold: quantity(sold),
        revenue: decimal(total),
        gross: lineCost === null ? null : decimal(total - lineCost),
      });
    }
    return {
      revenue: decimal(revenue),
      gross: known ? decimal(revenue - cost) : null,
      complete,
      invalid,
      rows,
    };
  }, [book, counts]);
  const open = async () => {
    setBusy(true);
    setError("");
    try {
      await write("/ledger/open", { date });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const submit = async (close: boolean) => {
    if (!book) return;
    setBusy(true);
    setError("");
    try {
      await write(`/ledger/${book.id}/${close ? "close" : "draft"}`, {
        version: book.version,
        stage: book.stage,
        counts: book.lines
          .filter((line) => (counts[line.inventoryItemId] ?? "") !== "")
          .map((line) => ({
            inventoryItemId: line.inventoryItemId,
            quantity: counts[line.inventoryItemId],
          })),
        note,
      });
      setConfirm(false);
      await load();
    } catch (e) {
      setConfirm(false);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const changeDate = (value: string) => {
    if (
      book?.stage !== 3 &&
      Object.values(counts).some(Boolean) &&
      !window.confirm(
        "Promjena datuma napušta trenutni unos. Jeste li spremili unesena stanja?",
      )
    )
      return;
    setDate(value);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ZADUŽENJE I PAZAR</div>
          <h1>Knjiga pazara</h1>
          <p>Početno stanje → predaja prve smjene → završno stanje dana.</p>
        </div>
        <Link className="button primary" to="/transfers">
          <ArrowRightLeft size={16} />
          Izdaj robu u kafić
        </Link>
      </div>
      <section className="panel ledger-toolbar">
        <label>
          Datum knjige
          <input
            type="date"
            value={date}
            max={localToday()}
            onChange={(e) => changeDate(e.target.value)}
          />
        </label>
        {book && (
          <span
            className={`status-pill ${book.stage === 3 ? "normal" : "low_stock"}`}
          >
            {stageNames[book.stage]}
          </span>
        )}
        <button
          className="button secondary"
          onClick={() => {
            if (
              window.confirm(
                "Osvježiti knjigu? Nespreman unos će se zamijeniti spremljenim stanjem.",
              )
            )
              void load();
          }}
          disabled={busy || loading}
        >
          <RefreshCw size={15} />
          Osvježi
        </button>
      </section>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <p className="empty-state">Učitavanje knjige…</p>
      ) : !book ? (
        <section className="panel ledger-empty">
          <BookOpen size={28} />
          <h2>Knjiga nije otvorena za ovaj datum</h2>
          <p>
            Početno stanje preuzima preostalu robu u kafiću. Izdavanje robe
            automatski otvara današnju knjigu.
          </p>
          <button className="button primary" onClick={open} disabled={busy}>
            {busy ? "Otvaranje…" : "Otvori knjigu"}
          </button>
        </section>
      ) : (
        <>
          <div className="sales-summary-grid">
            <article className="summary-card">
              <span>Pazar prve smjene</span>
              <b>{asMoney(book.totals.first)}</b>
              <small>
                {book.stage === 1 ? "Čeka predaju" : "Potvrđen obračun"}
              </small>
            </article>
            <article className="summary-card">
              <span>Pazar druge smjene</span>
              <b>{asMoney(book.totals.second)}</b>
              <small>
                {book.stage < 3 ? "Čeka kraj dana" : "Potvrđen obračun"}
              </small>
            </article>
            <article className="summary-card">
              <span>Ukupan pazar</span>
              <b>{asMoney(book.totals.revenue)}</b>
              <small>Iz zaključenih smjena</small>
            </article>
          </div>
          <section className="panel table-panel">
            <div className="panel-heading panel-heading-pad">
              <div>
                <h2>Zadužena prodajna roba</h2>
                <p>
                  Poredano po kategoriji i nazivu · unesite stvarno prebrojane
                  količine, uključujući nule.
                </p>
              </div>
            </div>
            <p className="ledger-scroll-hint">
              ↔ Pomjerite tabelu udesno za nabavne cijene, pazar i zaradu po
              artiklu.
            </p>
            <div className="table-scroll ledger-table">
              <table>
                <thead>
                  <tr>
                    {[
                      "Artikal",
                      "Početno / sinoć",
                      "Dopuna I",
                      "Predaja I",
                      "Prodano I",
                      "Dopuna II",
                      "Kraj dana",
                      "Prodano ukupno",
                      "Nabavna I / II*",
                      "Prodajna",
                      "Pazar",
                      "Bruto zarada*",
                    ].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {book.lines.map((line) => {
                    const row = preview.rows.get(line.inventoryItemId),
                      actualSold =
                        book.stage === 1
                          ? row?.sold
                          : book.stage === 2
                            ? row
                              ? quantity(
                                  scaled(line.soldFirst || "0") +
                                    scaled(row.sold),
                                )
                              : line.sold
                            : line.sold;
                    const rowRevenue =
                      book.stage === 1
                        ? row?.revenue
                        : book.stage === 2
                          ? row
                            ? decimal(
                                minor(line.revenueFirst) + minor(row.revenue),
                              )
                            : line.revenue
                          : line.revenue;
                    return (
                      <tr key={line.id}>
                        <td>
                          <b>{line.name}</b>
                          <small className="ledger-category">
                            {line.category || "Bez kategorije"} ·{" "}
                            {units[line.unit]}
                          </small>
                        </td>
                        <td>{line.opening}</td>
                        <td className="positive">+{line.receivedFirst}</td>
                        <td>
                          {book.stage === 1 ? (
                            <input
                              aria-label={`Predaja prve smjene · ${line.name}`}
                              type="number"
                              min="0"
                              step="0.001"
                              value={counts[line.inventoryItemId] ?? ""}
                              onChange={(e) =>
                                setCounts({
                                  ...counts,
                                  [line.inventoryItemId]: e.target.value,
                                })
                              }
                              placeholder="Unesi"
                            />
                          ) : (
                            (line.countFirst ?? "—")
                          )}
                        </td>
                        <td>
                          {book.stage === 1
                            ? (row?.sold ?? "—")
                            : (line.soldFirst ?? "—")}
                        </td>
                        <td className="positive">+{line.receivedSecond}</td>
                        <td>
                          {book.stage === 2 ? (
                            <input
                              aria-label={`Završno stanje · ${line.name}`}
                              type="number"
                              min="0"
                              step="0.001"
                              value={counts[line.inventoryItemId] ?? ""}
                              onChange={(e) =>
                                setCounts({
                                  ...counts,
                                  [line.inventoryItemId]: e.target.value,
                                })
                              }
                              placeholder="Unesi"
                            />
                          ) : (
                            (line.countFinal ?? "—")
                          )}
                        </td>
                        <td>
                          <b>{actualSold ?? "—"}</b>
                        </td>
                        <td>
                          {line.costFirst === null
                            ? "—"
                            : asMoney(Number(line.costFirst).toFixed(2))}
                          <br />
                          {line.costSecond === null
                            ? "—"
                            : asMoney(Number(line.costSecond).toFixed(2))}
                        </td>
                        <td>{asMoney(line.sellingPrice)}</td>
                        <td>
                          <b>{rowRevenue ? asMoney(rowRevenue) : "—"}</b>
                        </td>
                        <td>
                          {book.stage === 3
                            ? line.estimatedGross === null
                              ? "Nije poznato"
                              : asMoney(line.estimatedGross)
                            : "Nakon zaključivanja"}
                        </td>
                      </tr>
                    );
                  })}
                  {!book.lines.length && (
                    <tr>
                      <td colSpan={12} className="table-empty">
                        Označite prodajne artikle u magacinu i izdajite robu u
                        kafić.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          {book.stage < 3 && (
            <section className="panel ledger-actions">
              <div>
                <h2>Obračun {book.stage === 1 ? "prve" : "druge"} smjene</h2>
                <p>
                  Pregled prema unesenim stanjima:{" "}
                  <b>{asMoney(preview.revenue)}</b>
                  {preview.gross !== null && (
                    <>
                      {" "}
                      · procijenjena bruto zarada:{" "}
                      <b>{asMoney(preview.gross)}</b>
                    </>
                  )}
                </p>
                {!preview.complete && (
                  <p className="field-hint">
                    Za potvrdu unesite stanje svakog artikla.
                  </p>
                )}
                {preview.invalid && (
                  <p className="negative">
                    Prebrojano stanje ne može biti veće od zaduženja. Provjerite
                    dopune.
                  </p>
                )}
              </div>
              <label>
                Napomena uz predaju
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                  placeholder="Neobavezna napomena"
                />
              </label>
              <div className="form-actions">
                <button
                  className="button secondary"
                  onClick={() => submit(false)}
                  disabled={busy || preview.invalid}
                >
                  <Save size={15} />
                  Spremi unos
                </button>
                <button
                  className="button primary"
                  onClick={() => setConfirm(true)}
                  disabled={busy || !preview.complete || preview.invalid}
                >
                  <Check size={15} />
                  {book.stage === 1
                    ? "Potvrdi predaju prve smjene"
                    : "Zaključi dan i pazar"}
                </button>
              </div>
            </section>
          )}
          <section className="info-strip">
            <div>
              <b>
                Procijenjena bruto zarada:{" "}
                {book.totals.estimatedGross === null
                  ? "nedostaje poznata nabavna cijena"
                  : asMoney(book.totals.estimatedGross)}
              </b>
              <p>
                *Nabavna vrijednost prati ponderisanu procjenu robe izdate u
                kafić. Ovo nije neto dobit. Razlika zaduženja i prebrojanog
                stanja obračunava se kao prodaja; eventualne manjkove provjerite
                prije potvrde. Cijene u otvorenoj knjizi ostaju iste do kraja
                dana.
              </p>
            </div>
          </section>
        </>
      )}
      {confirm && book && (
        <Modal
          title={
            book.stage === 1
              ? "Potvrda predaje prve smjene"
              : "Potvrda završnog pazara"
          }
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <div className="modal-body form-stack">
            <p>
              Obračun smjene iznosi <b>{asMoney(preview.revenue)}</b>. Potvrdom
              se evidentira prodaja i preostalo stanje u kafiću.
            </p>
            <p>
              Provjerite fizički prebrojane količine. Zaključena smjena se ne
              može naknadno uređivati.
            </p>
            <div className="form-actions">
              <button
                className="button secondary"
                onClick={() => setConfirm(false)}
                disabled={busy}
              >
                Odustani
              </button>
              <button
                className="button primary"
                onClick={() => submit(true)}
                disabled={busy}
              >
                {busy ? "Knjiženje…" : "Potvrdi obračun"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
