import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Vehicles from "./pages/Vehicles";
import VehicleDetail from "./pages/VehicleDetail";
import Quotations from "./pages/Quotations";
import QuotationDetail from "./pages/QuotationDetail";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Receipt from "./pages/Receipt";
import Inventory from "./pages/Inventory";
import InventoryCategories from "./pages/InventoryCategories";
import Services from "./pages/Services";
import Segments from "./pages/Segments";
import SegmentDetail from "./pages/SegmentDetail";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import SystemSettings from "./pages/SystemSettings";
import Roles from "./pages/Roles";
import Users from "./pages/Users";
import VehicleManagement from "./pages/VehicleManagement";

const Protected = ({ children, roles, permission, masterOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const permissions = user?.permissions || {};
  const isMasterAdmin = user?.is_master_admin || user?.isMasterAdmin || false;

  if (isMasterAdmin) return children;

  if (masterOnly) return <Navigate to="/" replace />;

  if (permission && permissions[permission] !== true) {
    return <Navigate to="/" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" theme="dark" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Protected><Layout /></Protected>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/segments" element={<Protected roles={["admin","sales"]}><Segments /></Protected>} />
              <Route path="/customers/segments/:id" element={<Protected roles={["admin","sales"]}><SegmentDetail /></Protected>} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/vehicles" element={<Vehicles />} />
              <Route path="/vehicles/:id" element={<VehicleDetail />} />
              <Route path="/quotations" element={<Quotations />} />
              <Route path="/quotations/:id" element={<QuotationDetail />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route path="/jobs/:jid/receipts/:pid" element={<Receipt />} />
              <Route path="/inventory" element={<Protected roles={["admin","sales"]}><Inventory /></Protected>} />
              <Route path="/inventory/categories" element={<Protected roles={["admin","sales"]}><InventoryCategories /></Protected>} />
              <Route path="/services" element={<Protected roles={["admin"]}><Services /></Protected>} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Protected masterOnly><SystemSettings /></Protected>} />
              <Route path="/settings/legacy" element={<Protected masterOnly><Settings /></Protected>} />
              <Route path="/settings/roles" element={<Protected permission="settings_roles"><Roles /></Protected>} />
              <Route path="/settings/users" element={<Protected permission="settings_users"><Users /></Protected>} />
              <Route path="/settings/vehicle-management" element={<Protected permission="settings_vehicle_management"><VehicleManagement /></Protected>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
