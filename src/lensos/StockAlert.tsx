import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { api } from "../api/client";
export default function StockAlert() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void api<{ data: { lowStockCount: number; outOfStockCount: number } }>(
        "/dashboard/summary",
      )
        .then((result) => {
          if (active)
            setCount(result.data.lowStockCount + result.data.outOfStockCount);
        })
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener("lensos:stock-changed", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("lensos:stock-changed", refresh);
    };
  }, []);
  return count !== null && count > 0 ? (
    <Link className="stock-alert" to="/inventory" role="status">
      <Bell size={15} />
      <span>Naručiti: {count} artikala</span>
    </Link>
  ) : null;
}
