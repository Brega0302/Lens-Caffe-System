import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, asMoney, decimal, localToday, minor } from "../api/client";
import { type Sale, errorMessage } from "./types";
export default function SalesPage() {
  const [from, setFrom] = useState(localToday()),
    [to, setTo] = useState(localToday()),
    [rows, setRows] = useState<Sale[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [truncated, setTruncated] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api<{ data: Sale[]; truncated: boolean }>(`/sales?from=${from}&to=${to}`, {
      signal: controller.signal,
    })
      .then((result) => {
        setRows(result.data);
        setTruncated(result.truncated);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [from, to]);
  const summary = useMemo(() => {
    let total = 0n;
    const products = new Map<
      number,
      { name: string; quantity: number; revenue: bigint }
    >();
    for (const sale of rows) {
      total += minor(sale.total);
      for (const line of sale.items) {
        const product = products.get(line.inventoryItemId) || {
          name: line.productName,
          quantity: 0,
          revenue: 0n,
        };
        product.quantity += Math.round(line.quantity * 1000);
        product.revenue += minor(line.total);
        products.set(line.inventoryItemId, product);
      }
    }
    return { total: decimal(total), products: [...products.values()] };
  }, [rows]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">EVIDENTIRANI OBRAČUNI</div>
          <h1>Historija prodaje</h1>
          <p>Prodaja nastaje zaključivanjem smjene u knjizi pazara.</p>
        </div>
        <Link className="button primary" to="/ledger">
          Knjiga pazara
        </Link>
      </div>
      <section className="panel ledger-toolbar">
        <label>
          Od
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Do
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <strong>Prihod: {asMoney(summary.total)}</strong>
      </section>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {truncated && (
        <div className="alert error">
          Prikaz je ograničen na 5.000 prodaja. Sužite period za potpuni
          obračun.
        </div>
      )}
      <section className="panel table-panel">
        <div className="panel-heading">
          <h2>Prodaja po artiklu</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Artikal</th>
                <th>Prodana količina</th>
                <th>Prihod</th>
              </tr>
            </thead>
            <tbody>
              {summary.products.map((product) => (
                <tr key={product.name}>
                  <td>{product.name}</td>
                  <td>{product.quantity / 1000}</td>
                  <td>{asMoney(decimal(product.revenue))}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={3} className="table-empty">
                    {loading
                      ? "Učitavanje…"
                      : "Nema evidentiranih prodaja u ovom periodu."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel recent-sales">
        <div className="panel-heading">
          <h2>Historijski dokumenti</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Broj",
                  "Datum",
                  "Artikli",
                  "Evidentirao",
                  "Napomena",
                  "Ukupno",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>#{row.id}</td>
                  <td>{row.soldAt.replace("T", " ")}</td>
                  <td>
                    {row.items
                      .map(
                        (i) =>
                          `${i.productName} × ${i.quantity} @ ${asMoney(i.sellingPrice)}`,
                      )
                      .join(" · ")}
                  </td>
                  <td>{row.createdBy}</td>
                  <td>{row.note || "—"}</td>
                  <td>{asMoney(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
