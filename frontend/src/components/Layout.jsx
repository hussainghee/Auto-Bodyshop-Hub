import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, Car, FileText, Wrench, Package,
  SlidersHorizontal, BarChart3, Settings as SetIcon, LogOut, Search, ChevronDown, Menu, X
} from "lucide-react";
import NotificationsPanel from "./NotificationsPanel";
import CommandPalette from "./CommandPalette";

const LOGO = "https://customer-assets.emergentagent.com/job_vehicle-care-crm/artifacts/d5acrado_Wetworks-Logo.jpeg";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin","sales","technician"], perm: "dashboard" },
  {
    label: "Customers", icon: Users, roles: ["admin","sales"],
    children: [
      { to: "/customers", label: "Customers", perm: "customers" },
      { to: "/customers/segments", label: "Segments", perm: "segments" },
    ],
  },
  { to: "/vehicles", label: "Vehicles", icon: Car, roles: ["admin","sales"], perm: "vehicles" },
  { to: "/quotations", label: "Quotations", icon: FileText, roles: ["admin","sales"], perm: "quotations" },
  { to: "/jobs", label: "Job Cards", icon: Wrench, roles: ["admin","sales","technician"], perm: "jobs" },
  {
    label: "Inventory", icon: Package, roles: ["admin","sales"],
    children: [
      { to: "/inventory/categories", label: "Categories", perm: "inventory_categories" },
      { to: "/inventory", label: "Products", perm: "inventory_products" },
    ],
  },
  { to: "/services", label: "Services", icon: SlidersHorizontal, roles: ["admin"], perm: "services" },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin","sales"], perm: "reports" },
  {
    label: "Settings", icon: SetIcon, roles: ["admin"],
    children: [
      { to: "/settings/roles", label: "Roles", perm: "settings_roles" },
      { to: "/settings/users", label: "Users", perm: "settings_users" },
      { to: "/settings/vehicle-management", label: "Vehicle Management", perm: "settings_vehicle_management" },
      { to: "/settings", label: "System Settings", perm: "system_settings" },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const loc = useLocation();
  const [openGroup, setOpenGroup] = useState(() => {
    const init = {};
    NAV.forEach(n => { if (n.children) init[n.label] = n.children.some(c => loc.pathname === c.to || loc.pathname.startsWith(c.to + "/")); });
    return init;
  });
  // Auto-expand group when navigating to a child
  useEffect(() => {
    setOpenGroup(prev => {
      const next = { ...prev };
      let changed = false;
      NAV.forEach(n => {
        if (n.children && n.children.some(c => loc.pathname === c.to || loc.pathname.startsWith(c.to + "/"))) {
          if (!next[n.label]) { next[n.label] = true; changed = true; }
        }
      });
      return changed ? next : prev;
    });
  }, [loc.pathname]);
  // Close mobile drawer on route change
  useEffect(() => { setMobileNavOpen(false); }, [loc.pathname]);

const perms = user?.permissions || {};
const isMasterAdmin =
  user?.is_master === true ||
  user?.is_master_admin === true ||
  user?.isMasterAdmin === true;

const hasPermission = (perm) => {
  if (!perm) return true;
  if (isMasterAdmin) return true;
  return perms[perm] === true;
};

const visibleItems = NAV.map((it) => {
  if (!it.children) {
    return hasPermission(it.perm) ? it : null;
  }

  const kids = it.children.filter((child) => {
    // System Settings should only be visible for Master Admin
    if (child.perm === "system_settings") {
      return isMasterAdmin;
    }

    return hasPermission(child.perm);
  });

  return kids.length ? { ...it, children: kids } : null;
}).filter(Boolean);

  const NavList = ({ onNavigate }) => (
    <nav className="py-3 flex-1 overflow-y-auto">
      {visibleItems.map((item) => {
        if (item.children) {
          const Icon = item.icon;
          const isOpen = openGroup[item.label];
          const anyActive = item.children.some(c => loc.pathname === c.to);
          return (
            <div key={item.label}>
              <button
                onClick={() => { if (!anyActive) setOpenGroup({ ...openGroup, [item.label]: !isOpen }); }}
                className={`nav-link w-full ${anyActive ? "text-white" : ""}`}
                data-testid={`nav-${item.label.toLowerCase()}-group`}
              >
                <Icon size={16} strokeWidth={2} />
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && item.children.map(c => (
                <NavLink
                  key={c.to} to={c.to} end onClick={onNavigate}
                  className={({ isActive }) => `nav-link pl-11 text-[13px] ${isActive ? "active" : ""}`}
                  data-testid={`nav-${c.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                >
                  {c.label}
                </NavLink>
              ))}
            </div>
          );
        }
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
          >
            <Icon size={16} strokeWidth={2} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  const Brand = () => (
    <div className="px-5 py-5 border-b border-border flex items-center gap-3">
      <img src={LOGO} alt="Wetworks" className="w-10 h-10 rounded-sm object-cover" data-testid="brand-logo" />
      <div>
        <div className="font-display font-black text-lg leading-none tracking-tight" data-testid="brand">Wetworks</div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">CRM</div>
      </div>
    </div>
  );

  const UserFooter = () => (
    <div className="border-t border-border p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-sm bg-[#0066FF]/15 border border-[#0066FF]/40 flex items-center justify-center font-bold text-sm" data-testid="user-avatar">
        {user?.name?.[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{user?.name}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{user?.role}</div>
      </div>
      <button onClick={logout} className="text-muted-foreground hover:text-white p-1.5" data-testid="logout-btn" title="Logout">
        <LogOut size={16} />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 border-r border-border bg-[#0a0b0e] flex-col" data-testid="sidebar">
        <Brand />
        <NavList />
        <UserFooter />
      </aside>

      {/* Mobile drawer */}
      <div className={`md:hidden fixed inset-0 z-40 bg-black/70 transition-opacity ${mobileNavOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={() => setMobileNavOpen(false)} data-testid="mobile-nav-overlay" />
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-[#0a0b0e] flex flex-col transition-transform duration-200 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}
        data-testid="mobile-sidebar"
        aria-hidden={!mobileNavOpen}
      >
        <Brand />
        <NavList onNavigate={() => setMobileNavOpen(false)} />
        <UserFooter />
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto flex flex-col">
        <div className="sticky top-0 z-30 bg-[#050505]/95 backdrop-blur-sm border-b border-border px-4 md:px-8 py-3 flex items-center gap-2 no-print">
          {/* Mobile hamburger + brand */}
          <button onClick={() => setMobileNavOpen(true)} className="md:hidden p-1.5 text-muted-foreground hover:text-white" data-testid="mobile-nav-btn" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="md:hidden flex items-center gap-2 flex-1 min-w-0">
            <img src={LOGO} alt="Wetworks" className="w-7 h-7 rounded-sm object-cover" />
            <div className="font-display font-black text-base tracking-tight truncate">Wetworks</div>
          </div>
          <div className="flex-1 hidden md:block" />
          <button onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-sm text-xs text-muted-foreground hover:text-white hover:border-[#0066FF]/40"
            data-testid="command-k-btn">
            <Search size={12} /> <span className="hidden sm:inline">Search</span> <kbd className="text-[10px] uppercase ml-2 border border-border px-1 rounded-sm font-mono-data hidden sm:inline-block">⌘K</kbd>
          </button>
          <NotificationsPanel />
          <button onClick={() => setMobileNavOpen(false)} className={`md:hidden p-1.5 text-muted-foreground hover:text-white ${mobileNavOpen ? "" : "hidden"}`}>
            <X size={20} />
          </button>
        </div>
        <div className="flex-1"><Outlet /></div>
      </main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
