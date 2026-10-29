import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { api, asMoney, localToday, write } from "../api/client";
import Modal from "./Modal";
import {
  type Purchase,
  type InventoryItem,
  type InventoryResponse,
  errorMessage,
  units,
} from "./types";

const initial = () => ({
  supplier: "",
  purchaseDate: localToday(),
  invoiceReference: "",
  note: "",
  items: [{ inventoryItemId: "", quantity: "1", unitCost: "0.00" }],
});
export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]),
    [inventory, setInventory] = useState<InventoryItem[]>([]),
    [modal, setModal] = useState(false),
    [detail, setDetail] = useState<Purchase | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [form, setForm] = useState(initial);
  const load = async () => {
    try {
      const [p, i] = await Promise.all([
        api<{ data: Purchase[] }>("/purchases"),
        api<InventoryResponse>("/inventory"),
      ]);
      setPurchases(p.data);
      setInventory(i.data.filter((x) => x.active));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load().catch((e) => setError(errorMessage(e)));
  }, []);
  const close = () => {
    if (!busy) {
      setModal(false);
      setError("");
    }
  };
  const setLine = (index: number, key: string, value: string) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((line, i) =>
        i === index ? { ...line, [key]: value } : line,
      ),
    }));
  const selectItem = (index: number, id: string) => {
    const item = inventory.find((x) => String(x.id) === id);
    setForm((current) => ({
      ...current,
      items: current.items.map((line, i) =>
        i === index
          ? {
              ...line,
              inventoryItemId: id,
              unitCost: item?.purchasePrice || "0.00",
            }
          : line,
      ),
    }));
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await write("/purchases", form);
      setModal(false);
      setForm(initial());
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ULAZ ROBE</div>
          <h1>Nabavke</h1>
          <p>Evidentirajte isporuku i nabavnu cijenu svakog artikla.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setError("");
            setModal(true);
          }}
        >
          <Plus size={16} />
          Nova nabavka
        </button>
      </div>
      {error && !modal && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <section className="panel table-panel">
        <div className="panel-heading panel-heading-pad">
          <div>
            <h2>Historija nabavki</h2>
            <p>Posljednjih najviše 1.000 isporuka · kliknite broj za detalje</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Broj",
                  "Datum",
                  "Dobavljač",
                  "Račun",
                  "Artikli",
                  "Evidentirao",
                  "Ukupan trošak",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setDetail(p)}
                    >
                      #{p.id}
                    </button>
                  </td>
                  <td>{p.purchase_date}</td>
                  <td>{p.supplier_name || "—"}</td>
                  <td>{p.invoiceReference || "—"}</td>
                  <td>
                    {p.items
                      .map((i) => `${i.name} +${i.quantity} ${units[i.unit]}`)
                      .join(", ")}
                  </td>
                  <td>
                    {p.created_by_name}
                    {p.is_demo && <small className="demo-mark">DEMO</small>}
                  </td>
                  <td>
                    <b>{asMoney(p.totalCost)}</b>
                  </td>
                </tr>
              ))}
              {!purchases.length && (
                <tr>
                  <td colSpan={7} className="table-empty">
                    {loading ? "Učitavanje…" : "Nema evidentiranih nabavki."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {modal && (
        <Modal title="Nova nabavka" onClose={close} wide>
          <form className="form-stack modal-body" onSubmit={save}>
            <div className="form-row">
              <label>
                Dobavljač
                <input
                  value={form.supplier}
                  maxLength={160}
                  onChange={(e) =>
                    setForm({ ...form, supplier: e.target.value })
                  }
                />
              </label>
              <label>
                Datum nabavke
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) =>
                    setForm({ ...form, purchaseDate: e.target.value })
                  }
                  required
                />
              </label>
            </div>
            <label>
              Broj računa / fakture
              <input
                value={form.invoiceReference}
                maxLength={120}
                onChange={(e) =>
                  setForm({ ...form, invoiceReference: e.target.value })
                }
              />
            </label>
            <div className="form-section-title">
              <b>Stavke nabavke</b>
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    items: [
                      ...form.items,
                      { inventoryItemId: "", quantity: "1", unitCost: "0.00" },
                    ],
                  })
                }
              >
                <Plus size={15} />
                Dodaj stavku
              </button>
            </div>
            {form.items.map((line, index) => (
              <div className="purchase-line" key={index}>
                <label>
                  Artikal
                  <select
                    value={line.inventoryItemId}
                    onChange={(e) => selectItem(index, e.target.value)}
                    required
                  >
                    <option value="">Odaberite artikal</option>
                    {inventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {units[item.unit]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Količina
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={line.quantity}
                    onChange={(e) => setLine(index, "quantity", e.target.value)}
                    required
                  />
                </label>
                <label>
                  Jedinična cijena (KM)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitCost}
                    onChange={(e) => setLine(index, "unitCost", e.target.value)}
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
            <label>
              Napomena
              <textarea
                maxLength={1000}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </label>
            <p className="form-note">
              Potvrda trajno evidentira nabavku i povećava zalihe za navedene
              količine.
            </p>
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
                {busy ? "Spremanje…" : "Potvrdi nabavku"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal
          title={`Nabavka #${detail.id}`}
          onClose={() => setDetail(null)}
          wide
        >
          <div className="modal-body">
            <p>
              {detail.purchase_date} ·{" "}
              {detail.supplier_name || "Bez dobavljača"} · Račun:{" "}
              {detail.invoiceReference || "—"}
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {["Artikal", "Količina", "Cijena u nabavci", "Ukupno"].map(
                      (x) => (
                        <th key={x}>{x}</th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>
                        {item.quantity} {units[item.unit]}
                      </td>
                      <td>{asMoney(item.unitCost)}</td>
                      <td>{asMoney(item.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              <b>Ukupno: {asMoney(detail.totalCost)}</b>
            </p>
            <p>{detail.note}</p>
            <small>Evidentirao: {detail.created_by_name}</small>
          </div>
        </Modal>
      )}
    </>
  );
}
