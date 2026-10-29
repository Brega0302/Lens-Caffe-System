import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  ArrowDownUp,
  Clock3,
  Edit2,
  Plus,
  Search,
} from "lucide-react";
import { api, asMoney, write } from "../api/client";
import { Link } from "react-router-dom";
import Modal from "./Modal";
import {
  type InventoryItem,
  type InventoryResponse,
  type Category,
  type Movement,
  errorMessage,
  formatDate,
  movementNames,
  units,
} from "./types";

const blank = {
  name: "",
  category: "",
  unit: "piece",
  minimumQuantity: "0",
  purchasePrice: "0.00",
  sellingPrice: "0.00",
  supplier: "",
  notes: "",
  sellable: true,
};
export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]),
    [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState("name");
  const [modal, setModal] = useState(""),
    [editing, setEditing] = useState<InventoryItem | null>(null),
    [selected, setSelected] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(blank),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [movements, setMovements] = useState<Movement[]>([]),
    [delta, setDelta] = useState(""),
    [reason, setReason] = useState("");
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const result = await api<InventoryResponse>(
        `/inventory?search=${encodeURIComponent(search)}&categoryId=${category}&lowStock=${filter === "low"}&sort=${sort}`,
        { signal },
      );
      setItems(result.data);
      setCategories(result.categories);
      setLoading(false);
    },
    [search, category, filter, sort],
  );
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    load(controller.signal).catch((e) => {
      if (e.name !== "AbortError") {
        setError(errorMessage(e));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [load]);
  const close = () => {
    if (!busy) {
      setModal("");
      setError("");
    }
  };
  const openForm = (item: InventoryItem | null) => {
    setEditing(item);
    setForm(
      item
        ? {
            name: item.name,
            category: item.category || "",
            unit: item.unit,
            minimumQuantity: String(item.minimumQuantity),
            purchasePrice: item.purchasePrice,
            sellingPrice: item.sellingPrice,
            supplier: item.supplier || "",
            notes: item.notes || "",
            sellable: item.sellable,
          }
        : blank,
    );
    setError("");
    setModal("item");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(editing ? `/inventory/${editing.id}` : "/inventory", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      setModal("");
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const status = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api(`/inventory/${selected.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active: !selected.active }),
      });
      setModal("");
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const history = async (item: InventoryItem) => {
    setSelected(item);
    setError("");
    try {
      setMovements(
        (await api<{ data: Movement[] }>(`/inventory/${item.id}/movements`))
          .data,
      );
      setModal("history");
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const adjust = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await write(`/inventory/${selected.id}/adjustments`, {
        quantity: delta,
        note: reason,
        type: "MANUAL_ADJUSTMENT",
      });
      setModal("");
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const labels = {
    NORMAL: "Dovoljno",
    LOW_STOCK: "Niska zaliha",
    OUT_OF_STOCK: "Bez zalihe",
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SKLADIŠTE</div>
          <h1>Magacin</h1>
          <p>
            Sva roba, higijena i inventar · odvojene zalihe magacina i kafića.
          </p>
        </div>
        <div className="header-actions">
          <Link className="button secondary" to="/purchases">
            Dodaj zalihu
          </Link>
          <button className="button primary" onClick={() => openForm(null)}>
            <Plus size={16} />
            Dodaj artikal
          </button>
        </div>
      </div>
      {error && !modal && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <section className="panel table-panel">
        <div className="toolbar">
          <label className="search-box">
            <Search size={16} />
            <input
              aria-label="Pretraga artikala"
              placeholder="Pretraži artikle…"
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Kategorija"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Sve kategorije</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter zaliha"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Sve zalihe</option>
            <option value="low">Niske zalihe i bez zalihe</option>
          </select>
          <select
            aria-label="Sortiranje"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">Sortiraj: naziv</option>
            <option value="category">Sortiraj: kategorija</option>
            <option value="quantity">Sortiraj: količina</option>
            <option value="price">Sortiraj: nabavna cijena</option>
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Artikal",
                  "Kategorija",
                  "Magacin",
                  "U kafiću",
                  "Vrsta",
                  "Jedinica",
                  "Minimum",
                  "Nabavna cijena",
                  "Dobavljač",
                  "Zadnja nabavka",
                  "Status",
                  "Radnje",
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>{item.name}</b>
                    {item.demo && <small className="demo-mark">DEMO</small>}
                  </td>
                  <td>{item.category || "—"}</td>
                  <td
                    className={
                      item.status === "OUT_OF_STOCK"
                        ? "stock-zero"
                        : item.status === "LOW_STOCK"
                          ? "stock-low"
                          : ""
                    }
                  >
                    <b>{item.currentQuantity}</b>
                  </td>
                  <td>{item.cafeQuantity}</td>
                  <td>
                    {item.sellable ? "Prodajna roba" : "Potrošni materijal"}
                  </td>
                  <td>{units[item.unit]}</td>
                  <td>{item.minimumQuantity}</td>
                  <td>{asMoney(item.purchasePrice)}</td>
                  <td>{item.supplier || "—"}</td>
                  <td>{item.lastPurchasedAt || "—"}</td>
                  <td>
                    <span
                      className={`status-pill ${item.status.toLowerCase()}`}
                    >
                      {labels[item.status]}
                    </span>
                    {!item.active && (
                      <span className="status-pill inactive">Neaktivan</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        title="Uredi artikal"
                        onClick={() => openForm(item)}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        className="icon-button"
                        title="Korekcija zalihe"
                        disabled={!item.active}
                        onClick={() => {
                          setSelected(item);
                          setDelta("");
                          setReason("");
                          setError("");
                          setModal("adjust");
                        }}
                      >
                        <ArrowDownUp size={15} />
                      </button>
                      <button
                        className="icon-button"
                        title="Historija kretanja"
                        onClick={() => history(item)}
                      >
                        <Clock3 size={15} />
                      </button>
                      <button
                        className="icon-button"
                        title={item.active ? "Deaktiviraj" : "Aktiviraj"}
                        onClick={() => {
                          setSelected(item);
                          setError("");
                          setModal("status");
                        }}
                      >
                        <Archive size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={12} className="table-empty">
                    {loading
                      ? "Učitavanje…"
                      : "Nema artikala za odabrane filtere."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="table-footer">
          <span>{items.length} prikazanih artikala · najviše 1.000</span>
          <span>
            <Link to="/purchases">Dodaj robu u magacin</Link> ·{" "}
            <Link to="/transfers">Izdaj u kafić</Link>
          </span>
        </footer>
      </section>
      {modal === "item" && (
        <Modal
          title={editing ? "Uredi artikal" : "Dodaj artikal"}
          onClose={close}
        >
          <form className="form-stack modal-body" onSubmit={save}>
            <label>
              Naziv artikla
              <input
                value={form.name}
                maxLength={160}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <div className="form-row">
              <label>
                Kategorija
                <input
                  list="categories"
                  value={form.category}
                  maxLength={120}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
                <datalist id="categories">
                  {categories.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </label>
              <label>
                Jedinica mjere
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                >
                  {Object.entries(units).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Minimalna količina
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.minimumQuantity}
                  onChange={(e) =>
                    setForm({ ...form, minimumQuantity: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Nabavna cijena (KM)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchasePrice}
                  disabled={!!editing?.lastPurchasedAt}
                  onChange={(e) =>
                    setForm({ ...form, purchasePrice: e.target.value })
                  }
                  required
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Prodajna cijena (KM)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={(e) =>
                    setForm({ ...form, sellingPrice: e.target.value })
                  }
                  required
                />
              </label>
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
            </div>
            <label>
              <span className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.sellable}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sellable: e.target.checked,
                      ...(!e.target.checked ? { sellingPrice: "0.00" } : {}),
                    })
                  }
                />
                Artikal se prodaje i ulazi u knjigu pazara
              </span>
            </label>
            <label>
              Napomene
              <textarea
                value={form.notes}
                maxLength={1000}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            <p className="form-note">
              Stanje se mijenja kroz nabavku ili korekciju s razlogom. Nabavna
              cijena nakon prve nabavke ažurira se kroz novu nabavku.
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
                {busy ? "Spremanje…" : "Spremi artikal"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "adjust" && selected && (
        <Modal title={`Korekcija · ${selected.name}`} onClose={close}>
          <form className="form-stack modal-body" onSubmit={adjust}>
            <div className="current-stock">
              Trenutno stanje{" "}
              <strong>
                {selected.currentQuantity} {units[selected.unit]}
              </strong>
            </div>
            <label>
              Promjena količine
              <span className="field-hint">
                Za smanjenje koristite negativan broj.
              </span>
              <input
                type="number"
                step="0.001"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                required
              />
            </label>
            <label>
              Razlog promjene
              <input
                minLength={3}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </label>
            <p className="form-note">
              Potvrdom se trajno bilježe promjena, razlog i vaš korisnički
              račun.
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
                {busy ? "Spremanje…" : "Potvrdi korekciju"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "history" && selected && (
        <Modal title={`Historija · ${selected.name}`} onClose={close} wide>
          <div className="modal-body">
            {movements.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Vrijeme",
                        "Tip",
                        "Lokacija",
                        "Promjena",
                        "Prije → poslije",
                        "Korisnik",
                        "Razlog",
                      ].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td>{formatDate(m.createdAt)}</td>
                        <td>{movementNames[m.type] || m.type}</td>
                        <td>{m.location === "CAFE" ? "Kafić" : "Magacin"}</td>
                        <td
                          className={m.quantity > 0 ? "positive" : "negative"}
                        >
                          {m.quantity > 0 ? "+" : ""}
                          {m.quantity} {units[selected.unit]}
                        </td>
                        <td>
                          {m.previousQuantity} → {m.newQuantity}
                        </td>
                        <td>{m.createdBy}</td>
                        <td>{m.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">Nema zabilježenih kretanja.</p>
            )}
            <small>Prikaz posljednjih 1.000 kretanja · Europe/Sarajevo</small>
          </div>
        </Modal>
      )}
      {modal === "status" && selected && (
        <Modal
          title={
            selected.active ? "Deaktivacija artikla" : "Aktivacija artikla"
          }
          onClose={close}
        >
          <div className="modal-body form-stack">
            <p>
              {selected.active
                ? `Deaktivirati ${selected.name}? Artikal će biti uklonjen iz izbora za nove nabavke i prodaje.`
                : `Aktivirati ${selected.name}?`}
            </p>
            {error && <div className="alert error">{error}</div>}
            <div className="form-actions">
              <button
                className="button secondary"
                onClick={close}
                disabled={busy}
              >
                Odustani
              </button>
              <button
                className="button primary"
                onClick={status}
                disabled={busy}
              >
                {busy ? "Spremanje…" : "Potvrdi"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
