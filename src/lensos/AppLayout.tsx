import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Boxes,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  ShoppingBasket,
  Coffee,
  BookOpen,
  ArrowRightLeft,
} from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { api } from "../api/client";
import { cafeDate } from "./types";
import StockAlert from "./StockAlert";

const links = [
  { to: "/", label: "Pregled", icon: LayoutDashboard, end: true },
  { to: "/inventory", label: "Magacin", icon: Boxes },
  { to: "/transfers", label: "Izdavanje robe", icon: ArrowRightLeft },
  { to: "/ledger", label: "Knjiga pazara", icon: BookOpen },
  { to: "/purchases", label: "Nabavke", icon: ShoppingBasket },
  { to: "/sales", label: "Historija prodaje", icon: ReceiptText },
];
const roles: Record<string, string> = {
  OWNER: "Vlasnik",
  MANAGER: "Menadžer",
  EMPLOYEE: "Zaposlenik",
};
export default function AppLayout() {
  const { user, logout } = useAuth();
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    let active = true;
    api<{ demo: boolean }>("/session")
      .then((result) => {
        if (active) setDemo(result.demo);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">
            <Coffee size={19} />
          </span>
          <div>
            <b>LensOS</b>
            <small>Caffe Lens</small>
          </div>
        </div>
        <div className="nav-label">RADNI PROSTOR</div>
        <nav className="main-nav" aria-label="Glavna navigacija">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <span className="user-avatar">
              {user?.username?.[0]?.toUpperCase() || "V"}
            </span>
            <span>
              <b>{user?.username}</b>
              <small>{roles[user?.role || "OWNER"]}</small>
            </span>
          </div>
          <button className="sign-out" onClick={() => logout()}>
            <LogOut size={16} />
            Odjavi se
          </button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">CAFFE LENS · POSLOVANJE</span>
            <span className="topbar-date">{cafeDate(true)}</span>
          </div>
          <div className="header-actions">
            <StockAlert />
            <span className="currency-pill">BAM · KM</span>
          </div>
        </header>
        {demo && (
          <div className="demo-banner" role="status">
            <b>DEMO OKRUŽENJE</b> · Primjeri su odvojeni od stvarne poslovne
            evidencije.
          </div>
        )}
        <button className="mobile-logout" onClick={() => logout()}>
          Odjavi se · {user?.username}
        </button>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
