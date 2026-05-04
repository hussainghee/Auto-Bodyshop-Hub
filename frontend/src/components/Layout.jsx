import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, Car, FileText, Wrench, Package,
  SlidersHorizontal, BarChart3, Settings as SetIcon, LogOut, Search, ChevronDown
} from "lucide-react";
import NotificationsPanel from "./NotificationsPanel";
import CommandPalette from "./CommandPalette";

const LOGO = "https://customer-assets.emergentagent.com/job_vehicle-care-crm/artifacts/d5acrado_Wetworks-Logo.jpeg";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin","sales","technician"] },
  {
    label: "Customers", icon: Users, roles: ["admin","sales"],
    children: [
      { to: "/customers", label: "Customers" },
      { to: "/customers/segments", label: "Segments" },
    ],
  },
  { to: "/vehicles", label: "Vehicles", icon: Car, roles: ["admin","sales"] },
  { to: "/quotations", label: "Quotations", icon: FileText, roles: ["admin","sales"] },
  { to: "/jobs", label: "Job Cards", icon: Wrench, roles: ["admin","sales","technician"] },
  { to: "/inventory", label: "Inventory", icon: Package, roles: ["admin","sales"] },
  { to: "/services", label: "Services & Pricing", icon: SlidersHorizontal, roles: ["admin"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin","sales"] },
  { to: "/settings", label: "Settings", icon: SetIcon, roles: ["admin"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const loc = useLocation();
  const [openGroup, setOpenGroup] = useState(() => {
    const init = {};
    NAV.forEach(n => { if (n.children) init[n.label] = n.children.some(c => loc.pathname === c.to || loc.pathname.startsWith(c.to + "/")); });
    return init;
  });
  // Keep group open whenever route lands on one of its children
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
  const items = NAV.filter(n => n.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-60 border-r border-border bg-[#0a0b0e] flex flex-col" data-testid="sidebar">
        <div className="px-5 py-5 border-b border-border flex items-center gap-3">
          <img src={LOGO} alt="Wetworks" className="w-10 h-10 rounded-sm object-cover" data-testid="brand-logo" />
          <div>
            <div className="font-display font-black text-lg leading-none tracking-tight" data-testid="brand">Wetworks</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">CRM</div>
          </div>
        </div>
        <nav className="py-3 flex-1 overflow-y-auto">
          {items.map((item) => {
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
                      key={c.to} to={c.to} end
                      className={({ isActive }) => `nav-link pl-11 text-[13px] ${isActive ? "active" : ""}`}
                      data-testid={`nav-${c.label.toLowerCase()}`}
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
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              >
                <Icon size={16} strokeWidth={2} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
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
      </aside>
      <main className="flex-1 overflow-y-auto flex flex-col">
        <div className="sticky top-0 z-30 bg-[#050505]/95 backdrop-blur-sm border-b border-border px-8 py-3 flex items-center justify-end gap-2 no-print">
          <button onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-sm text-xs text-muted-foreground hover:text-white hover:border-[#0066FF]/40"
            data-testid="command-k-btn">
            <Search size={12} /> Search <kbd className="text-[10px] uppercase ml-2 border border-border px-1 rounded-sm font-mono-data">⌘K</kbd>
          </button>
          <NotificationsPanel />
        </div>
        <div className="flex-1"><Outlet /></div>
      </main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
