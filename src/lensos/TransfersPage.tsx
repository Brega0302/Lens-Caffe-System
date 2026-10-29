import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowRightLeft } from "lucide-react";
import { api, write } from "../api/client";
import {
  type InventoryItem,
  type InventoryResponse,
  errorMessage,
  formatDate,
  units,
} from "./types";
import Modal from "./Modal";
type Transfer = {
  id: number;
  shift: number;
  note: string | null;
  createdAt: string;
  createdByName: string;
  items: { id: number; name: string; unit: string; quantity: string }[];
};
const initial = () => ({
  note: "",
  items: [{ inventoryItemId: "", quantity: "1" }],
});
export default function TransfersPage() {
  const [rows, setRows] = useState<Transfer[]>([]),
    [inventory, setInventory] = useState<InventoryItem[]>([]),
    [form, setForm] = useState(initial),
    [modal, setModal] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = async () => {
    try {
      const [r, i] = await Promise.all([
        api<{ data: Transfer[] }>("/stock-transfers"),
        api<InventoryResponse>("/inventory"),
      ]);
      setRows(r.data);
      setInventory(i.data.filter((x) => x.active));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load().catch((e) => setError(errorMessage(e)));
  }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await write("/stock-transfers", form);
      setModal(false);
      setForm(initial());
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    if (!busy) setModal(false);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAGACIN → KAFIĆ</div>
          <h1>Izdavanje robe</h1>
          <p>
            Roba se prenosi iz magacina u kafić i dopisuje otvorenoj smjeni.
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setError("");
            setModal(true);
          }}
        >
          <ArrowRightLeft size={16} />
          Izdaj robu
        </button>
      </div>
      <section className="info-strip">
        <div>
          <b>Nabavka puni magacin. Izdavanje puni kafić.</b>
          <p>
            Prodajni artikli automatski ulaze u{" "}
            <Link to="/ledger">Knjigu pazara</Link>. Potrošni materijal ostaje
            van obračuna prodaje.
          </p>
        </div>
      </section>
      {error && !modal && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <section className="panel table-panel">
        <div className="panel-heading">
          <h2>Historija izdavanja</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Broj",
                  "Vrijeme",
                  "Smjena",
                  "Roba i količina",
                  "Evidentirao",
                  "Napomena",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>#{row.id}</td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>{row.shift}.</td>
                  <td>
                    {row.items
                      .map(
                        (item) =>
                          `${item.name} +${item.quantity} ${units[item.unit]}`,
                      )
                      .join(", ")}
                  </td>
                  <td>{row.createdByName}</td>
                  <td>{row.note || "—"}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="table-empty">
                    {loading
                      ? "Učitavanje…"
                      : "Roba još nije izdavana u kafić."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {modal && (
        <Modal title="Izdaj robu iz magacina" onClose={close} wide>
          <form className="form-stack modal-body" onSubmit={save}>
            <p className="form-note">
              Potvrda istovremeno smanjuje magacin i povećava kafić. Za prodajnu
              robu dopunjava knjigu tekuće smjene.
            </p>
            {form.items.map((line, index) => (
              <div className="purchase-line transfer-line" key={index}>
                <label>
                  Artikal
                  <select
                    aria-label="Artikal za izdavanje"
                    value={line.inventoryItemId}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        items: form.items.map((x, i) =>
                          i === index
                            ? { ...x, inventoryItemId: e.target.value }
                            : x,
                        ),
                      })
                    }
                    required
                  >
                    <option value="">Odaberite artikal</option>
                    {inventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · magacin {item.currentQuantity}{" "}
                        {units[item.unit]}
                        {item.sellable ? "" : " · potrošni materijal"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Količina za izdavanje
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={line.quantity}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        items: form.items.map((x, i) =>
                          i === index ? { ...x, quantity: e.target.value } : x,
                        ),
                      })
                    }
                    required
                  />
                </label>
                {form.items.length > 1 && (
                  <button
                    type="button"
                    className="remove-line"
                    onClick={() =>
                      setForm({
                        ...form,
                        items: form.items.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Ukloni
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setForm({
                  ...form,
                  items: [
                    ...form.items,
                    { inventoryItemId: "", quantity: "1" },
                  ],
                })
              }
            >
              <Plus size={15} />
              Dodaj stavku
            </button>
            <label>
              Napomena
              <input
                maxLength={1000}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="npr. Jutarnje zaduženje"
              />
            </label>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={close}
                disabled={busy}
              >
                Odustani
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "Izdavanje…" : "Potvrdi izdavanje"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
