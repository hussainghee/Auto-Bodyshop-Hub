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
import JobCreate from "./pages/JobCreate";

const isMasterAdminUser = (user) =>
  user?.is_master === true ||
  user?.is_master_admin === true ||
  user?.isMasterAdmin === true;

const getDefaultRoute = (user) => {
  const permissions = user?.permissions || {};

  if (isMasterAdminUser(user)) return "/dashboard";

  if (permissions.dashboard === true) return "/dashboard";
  if (permissions.customers === true) return "/customers";
  if (permissions.segments === true) return "/customers/segments";
  if (permissions.vehicles === true) return "/vehicles";
  if (permissions.quotations === true) return "/quotations";
  if (permissions.jobs === true) return "/jobs";
  if (permissions.inventory_categories === true) return "/inventory/categories";
  if (permissions.inventory_products === true) return "/inventory";
  if (permissions.services === true) return "/services";
  if (permissions.reports === true) return "/reports";
  if (permissions.settings_roles === true) return "/settings/roles";
  if (permissions.settings_users === true) return "/settings/users";
  if (permissions.settings_vehicle_management === true) return "/settings/vehicle-management";
  if (permissions.system_settings === true) return "/settings";

  return "/no-access";
};

const HomeRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={getDefaultRoute(user)} replace />;
};

const NoAccess = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
    <div className="text-center">
      <h1 className="text-2xl font-bold mb-2">No Access</h1>
      <p className="text-muted-foreground">
        You do not have access to any module. Please contact the administrator.
      </p>
    </div>
  </div>
);

const Protected = ({ children, permission, masterOnly = false }) => {
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
  const isMasterAdmin = isMasterAdminUser(user);

  if (isMasterAdmin) return children;

  if (masterOnly) return <Navigate to={getDefaultRoute(user)} replace />;

  if (permission && permissions[permission] !== true) {
    return <Navigate to={getDefaultRoute(user)} replace />;
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
            <Route path="/no-access" element={<NoAccess />} />

            <Route element={<Protected><Layout /></Protected>}>
              <Route path="/" element={<HomeRedirect />} />

              <Route
                path="/dashboard"
                element={
                  <Protected permission="dashboard">
                    <Dashboard />
                  </Protected>
                }
              />

              <Route
                path="/customers"
                element={
                  <Protected permission="customers">
                    <Customers />
                  </Protected>
                }
              />

              <Route
                path="/customers/segments"
                element={
                  <Protected permission="segments">
                    <Segments />
                  </Protected>
                }
              />

              <Route
                path="/customers/segments/:id"
                element={
                  <Protected permission="segments">
                    <SegmentDetail />
                  </Protected>
                }
              />

              <Route
                path="/customers/:id"
                element={
                  <Protected permission="customers">
                    <CustomerDetail />
                  </Protected>
                }
              />

              <Route
                path="/vehicles"
                element={
                  <Protected permission="vehicles">
                    <Vehicles />
                  </Protected>
                }
              />

              <Route
                path="/vehicles/:id"
                element={
                  <Protected permission="vehicles">
                    <VehicleDetail />
                  </Protected>
                }
              />

              <Route
                path="/quotations"
                element={
                  <Protected permission="quotations">
                    <Quotations />
                  </Protected>
                }
              />

              <Route
                path="/quotations/:id"
                element={
                  <Protected permission="quotations">
                    <QuotationDetail />
                  </Protected>
                }
              />

              <Route
                path="/jobs"
                element={
                  <Protected permission="jobs">
                    <Jobs />
                  </Protected>
                }
              />

              <Route
                    path="/jobs/new"
                    element={
                      <Protected permission="jobs">
                        <JobCreate />
                      </Protected>
                    }
                  />

              <Route
                path="/jobs/:id"
                element={
                  <Protected permission="jobs">
                    <JobDetail />
                  </Protected>
                }
              />

              <Route
                path="/jobs/:jid/receipts/:pid"
                element={
                  <Protected permission="jobs">
                    <Receipt />
                  </Protected>
                }
              />

              <Route
                path="/inventory"
                element={
                  <Protected permission="inventory_products">
                    <Inventory />
                  </Protected>
                }
              />

              <Route
                path="/inventory/categories"
                element={
                  <Protected permission="inventory_categories">
                    <InventoryCategories />
                  </Protected>
                }
              />

              <Route
                path="/services"
                element={
                  <Protected permission="services">
                    <Services />
                  </Protected>
                }
              />

              <Route
                path="/reports"
                element={
                  <Protected permission="reports">
                    <Reports />
                  </Protected>
                }
              />

              <Route
                path="/settings"
                element={
                  <Protected masterOnly>
                    <SystemSettings />
                  </Protected>
                }
              />

              <Route
                path="/settings/legacy"
                element={
                  <Protected masterOnly>
                    <Settings />
                  </Protected>
                }
              />

              <Route
                path="/settings/roles"
                element={
                  <Protected permission="settings_roles">
                    <Roles />
                  </Protected>
                }
              />

              <Route
                path="/settings/users"
                element={
                  <Protected permission="settings_users">
                    <Users />
                  </Protected>
                }
              />

              <Route
                path="/settings/vehicle-management"
                element={
                  <Protected permission="settings_vehicle_management">
                    <VehicleManagement />
                  </Protected>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
