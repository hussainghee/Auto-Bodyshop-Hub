import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtKWD } from "../lib/api";
import { Search, Users, Car, Wrench, FileText } from "lucide-react";
import { Dialog, DialogContent } from "./ui/dialog";

export default function CommandPalette({ open, onOpenChange }) {
  const [q, setQ] = useState("");
  const [customers, setCustomers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    if (!open) return;
    setQ("");
    Promise.all([
      api.get("/customers"), api.get("/jobs"), api.get("/quotations"), api.get("/vehicles"),
    ]).then(([c, j, qu, v]) => {
      setCustomers(c.data); setJobs(j.data); setQuotations(qu.data); setVehicles(v.data);
    }).catch(() => {});
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpenChange]);

  const ql = q.toLowerCase().trim();
  const filtered = ql ? {
    customers: customers.filter(c => c.name.toLowerCase().includes(ql) || c.mobile.includes(q)).slice(0, 5),
    jobs: jobs.filter(j => j.number.toLowerCase().includes(ql)).slice(0, 5),
    quotations: quotations.filter(q => q.number.toLowerCase().includes(ql)).slice(0, 5),
    vehicles: vehicles.filter(v => `${v.make} ${v.model} ${v.plate || ""}`.toLowerCase().includes(ql)).slice(0, 5),
  } : { customers: customers.slice(0, 5), jobs: jobs.slice(0, 5), quotations: quotations.slice(0, 3), vehicles: [] };

  const go = (path) => { onOpenChange(false); nav(path); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-2xl p-0" data-testid="command-palette">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Search size={16} className="text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers, jobs, quotations, vehicles…"
            className="flex-1 bg-transparent outline-none text-sm" data-testid="command-input" />
          <kbd className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border px-1.5 py-0.5 rounded-sm">ESC</kbd>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <Group label="Customers" icon={Users}>
            {filtered.customers.map(c => (
              <Row key={c.id} onClick={() => go(`/customers/${c.id}`)} primary={c.name} secondary={c.mobile} />
            ))}
          </Group>
          <Group label="Jobs" icon={Wrench}>
            {filtered.jobs.map(j => (
              <Row key={j.id} onClick={() => go(`/jobs/${j.id}`)} primary={j.number} secondary={`${j.status} · ${fmtKWD(j.total)}`} />
            ))}
          </Group>
          <Group label="Quotations" icon={FileText}>
            {filtered.quotations.map(q => (
              <Row key={q.id} onClick={() => go(`/quotations/${q.id}`)} primary={q.number} secondary={`${q.status} · ${fmtKWD(q.total)}`} />
            ))}
          </Group>
          {filtered.vehicles.length > 0 && (
            <Group label="Vehicles" icon={Car}>
              {filtered.vehicles.map(v => (
                <Row key={v.id} onClick={() => go(`/vehicles/${v.id}`)} primary={`${v.make} ${v.model}`} secondary={v.plate || "—"} />
              ))}
            </Group>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const Group = ({ label, icon: Icon, children }) => {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <div>
      <div className="px-5 py-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-[#0a0b0e]">
        <Icon size={12} /> {label}
      </div>
      {children}
    </div>
  );
};

const Row = ({ onClick, primary, secondary }) => (
  <button onClick={onClick} className="w-full text-left px-5 py-2.5 flex items-center justify-between hover:bg-white/[0.04] border-b border-border/40">
    <div className="text-sm font-semibold">{primary}</div>
    <div className="text-xs text-muted-foreground font-mono-data">{secondary}</div>
  </button>
);
