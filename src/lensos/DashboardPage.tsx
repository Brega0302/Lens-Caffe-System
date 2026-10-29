import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { api, asMoney, localToday } from "../api/client";
import { type Dashboard, errorMessage, units, cafeDate } from "./types";

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        (
          await api<{ data: Dashboard }>(
            "/dashboard/summary?date=" + localToday(),
          )
        ).data,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{cafeDate()}</div>
          <h1>Dobar dan</h1>
          <p>Današnje poslovanje i artikli kojima treba pažnja.</p>
        </div>
        <button className="button secondary" onClick={load} disabled={loading}>
          <RefreshCw size={15} />
          Osvježi
        </button>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {loading && !data ? (
        <p className="empty-state">Učitavanje pregleda…</p>
      ) : (
        data && (
          <>
            <div className="metric-grid">
              {[
                [
                  "Današnji prihod",
                  asMoney(data.todayRevenue),
                  "Evidentirane prodaje",
                ],
                ["Prodana količina", data.itemsSold, "Zbir količina artikala"],
                ["Aktivni artikli", data.inventoryItems, "U evidenciji zaliha"],
                ["Niske zalihe", data.lowStockCount, "Na ili ispod minimuma"],
                ["Bez zalihe", data.outOfStockCount, "Potrebna nabavka"],
              ].map(([title, value, detail]) => (
                <article className="metric-card" key={title}>
                  <span>{title}</span>
                  <strong>{value}</strong>
                  <small>{detail}</small>
                </article>
              ))}
            </div>
            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Najprodavaniji artikli danas</h2>
                    <p>Prema prodanoj količini</p>
                  </div>
                  <Link className="text-button" to="/sales">
                    Sve prodaje
                  </Link>
                </div>
                {data.topProducts.length ? (
                  <div className="rank-list">
                    {data.topProducts.map((item, i) => (
                      <div className="rank-item" key={item.name}>
                        <span className="rank-number">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <b>{item.name}</b>
                        <span>{item.quantity} prodano</span>
                        <strong>{asMoney(item.revenue)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">
                    Danas nema evidentiranih prodaja.
                  </p>
                )}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Potrebno naručiti</h2>
                    <p>Magacin: artikli na minimumu ili bez zalihe</p>
                  </div>
                  <Link className="text-button" to="/inventory">
                    Zalihe
                  </Link>
                </div>
                <div className="attention-list">
                  {data.outOfStock.slice(0, 5).map((item) => (
                    <div className="attention-row danger" key={item.id}>
                      <span className="attention-dot" />
                      <b>{item.name}</b>
                      <span>Bez zalihe</span>
                    </div>
                  ))}
                  {data.lowStock.slice(0, 5).map((item) => (
                    <div className="attention-row" key={item.id}>
                      <span className="attention-dot" />
                      <b>{item.name}</b>
                      <span>
                        {item.currentQuantity} {units[item.unit]} · min.{" "}
                        {item.minimumQuantity}
                      </span>
                    </div>
                  ))}
                  {!data.lowStock.length && !data.outOfStock.length && (
                    <p className="empty-state">
                      Svi aktivni artikli imaju dovoljnu zalihu.
                    </p>
                  )}
                </div>
              </section>
            </div>
            <section className="info-strip">
              <div>
                <b>Prihod iz evidencije prodaje</b>
                <p>
                  Prikaz obuhvata prodaje u vremenskoj zoni Europe/Sarajevo.
                  Obračun smjena i procijenjena bruto zarada dostupni su u
                  Knjizi pazara. Rashodi i neto dobit nisu uključeni.
                </p>
              </div>
            </section>
          </>
        )
      )}
    </>
  );
}
