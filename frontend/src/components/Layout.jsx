import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, Car, FileText, Wrench, Package,
  SlidersHorizontal, CalendarDays, BarChart3, Settings as SetIcon, LogOut, Search
} from "lucide-react";
import NotificationsPanel from "./NotificationsPanel";
import CommandPalette from "./CommandPalette";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin","sales","technician"] },
  { to: "/customers", label: "Customers", icon: Users, roles: ["admin","sales"] },
  { to: "/vehicles", label: "Vehicles", icon: Car, roles: ["admin","sales"] },
  { to: "/quotations", label: "Quotations", icon: FileText, roles: ["admin","sales"] },
  { to: "/jobs", label: "Job Cards", icon: Wrench, roles: ["admin","sales","technician"] },
  { to: "/inventory", label: "Inventory", icon: Package, roles: ["admin","sales"] },
  { to: "/services", label: "Services & Pricing", icon: SlidersHorizontal, roles: ["admin"] },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, roles: ["admin","sales","technician"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin","sales"] },
  { to: "/settings", label: "Settings", icon: SetIcon, roles: ["admin"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const items = NAV.filter(n => n.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-60 border-r border-border bg-[#0a0b0e] flex flex-col" data-testid="sidebar">
        <div className="px-5 py-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 brand-stripe rounded-sm" />
            <div>
              <div className="font-display font-black text-lg leading-none tracking-tighter">AUTO/CRM</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">Kuwait • KWD</div>
            </div>
          </div>
        </div>
        <nav className="py-3 flex-1 overflow-y-auto">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              data-testid={`nav-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
            >
              <Icon size={16} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
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
