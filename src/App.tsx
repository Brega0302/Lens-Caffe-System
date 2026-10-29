import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/useAuth";
import AppLayout from "./lensos/AppLayout";
import DashboardPage from "./lensos/DashboardPage";
import InventoryPage from "./lensos/InventoryPage";
import PurchasesPage from "./lensos/PurchasesPage";
import SalesPage from "./lensos/SalesPage";
import LoginPage from "./lensos/LoginPage";
import LedgerPage from "./lensos/LedgerPage";
import TransfersPage from "./lensos/TransfersPage";

function ProtectedWorkspace() {
  const { session } = useAuth();
  return session ? <AppLayout /> : <Navigate to="/login" replace />;
}

function LoginRoute() {
  const { session } = useAuth();
  return session ? <Navigate to="/" replace /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route element={<ProtectedWorkspace />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/ledger" element={<LedgerPage />} />
            <Route path="/transfers" element={<TransfersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
