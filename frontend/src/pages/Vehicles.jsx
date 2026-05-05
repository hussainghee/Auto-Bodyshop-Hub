import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDate, API } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Search, Download, Filter, X } from "lucide-react";
import { toast } from "sonner";

export default function Vehicles() {
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState({});
  const [vts, setVts] = useState([]);
  const [makes, setMakes] = useState([]);

  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ make: "", model: "", year: "", vehicle_type: "", color: "", start: "", end: "" });

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    const [v, c] = await Promise.all([
      api.get("/vehicles", { params }),
      api.get("/customers"),
    ]);
    setList(v.data);
    setCustomers(Object.fromEntries(c.data.map(x => [x.id, x])));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, filters]);
  useEffect(() => {
    api.get("/vehicle-types").then(r => setVts(r.data));
    api.get("/vehicle-makes").then(r => setMakes(r.data));
  }, []);

  const selectedMake = makes.find(m => m.label === filters.make);

  const clearFilters = () => setFilters({ make: "", model: "", year: "", vehicle_type: "", color: "", start: "", end: "" });

  const exportVehicles = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await fetch(`${API}/export/vehicles?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `vehicles_${new Date().toISOString().slice(0,10)}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported");
    } catch { toast.error("Export failed"); }
  };

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div data-testid="vehicles-page">
      <PageHeader title="Vehicles" subtitle="Fleet"
        actions={<Button variant="outline" onClick={exportVehicles} className="border-border rounded-sm" data-testid="export-vehicles-btn"><Download size={14} className="mr-1.5" /> Export</Button>}
      />
      <div className="p-4 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] sm:min-w-[280px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search brand, model, year, plate, VIN, customer name/mobile…" value={q} onChange={e => setQ(e.target.value)} className="pl-9 bg-[#0F1115] border-border rounded-sm h-10" data-testid="vehicle-search" />
          </div>
          {activeCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="border-border rounded-sm"><X size={12} className="mr-1" /> Clear {activeCount} filter{activeCount > 1 ? "s" : ""}</Button>
          )}
        </div>

        <div className="border border-border bg-[#0F1115] rounded-sm p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} className="text-muted-foreground" />
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Filters</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider">Brand</Label>
              <Select value={filters.make || "__all__"} onValueChange={(v) => setFilters({ ...filters, make: v === "__all__" ? "" : v, model: "" })}>
                <SelectTrigger className="mt-1 bg-background border-border rounded-sm h-9" data-testid="filter-make"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent className="bg-[#0F1115] border-border max-h-[300px]">
                  <SelectItem value="__all__">All</SelectItem>
                  {makes.map(m => <SelectItem key={m.id} value={m.label}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider">Model</Label>
              <Select value={filters.model || "__all__"} onValueChange={(v) => setFilters({ ...filters, model: v === "__all__" ? "" : v })} disabled={!selectedMake}>
                <SelectTrigger className="mt-1 bg-background border-border rounded-sm h-9" data-testid="filter-model"><SelectValue placeholder={selectedMake ? "All" : "Pick brand"} /></SelectTrigger>
                <SelectContent className="bg-[#0F1115] border-border max-h-[300px]">
                  <SelectItem value="__all__">All</SelectItem>
                  {(selectedMake?.models || []).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-[10px] uppercase tracking-wider">Year</Label><Input type="text" inputMode="numeric" pattern="[0-9]*" value={filters.year} onChange={e => setFilters({ ...filters, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} className="mt-1 bg-background border-border rounded-sm h-9" data-testid="filter-year" /></div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider">Type</Label>
              <Select value={filters.vehicle_type || "__all__"} onValueChange={(v) => setFilters({ ...filters, vehicle_type: v === "__all__" ? "" : v })}>
                <SelectTrigger className="mt-1 bg-background border-border rounded-sm h-9" data-testid="filter-type"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent className="bg-[#0F1115] border-border">
                  <SelectItem value="__all__">All</SelectItem>
                  {vts.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-[10px] uppercase tracking-wider">Color</Label><Input value={filters.color} onChange={e => setFilters({ ...filters, color: e.target.value })} className="mt-1 bg-background border-border rounded-sm h-9" /></div>
            <div><Label className="text-[10px] uppercase tracking-wider">From</Label><Input type="date" value={filters.start} onChange={e => setFilters({ ...filters, start: e.target.value })} className="mt-1 bg-background border-border rounded-sm h-9" data-testid="filter-start" /></div>
            <div><Label className="text-[10px] uppercase tracking-wider">To</Label><Input type="date" value={filters.end} onChange={e => setFilters({ ...filters, end: e.target.value })} className="mt-1 bg-background border-border rounded-sm h-9" data-testid="filter-end" /></div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">{list.length} vehicle{list.length !== 1 ? "s" : ""} matching</div>

        <div className="border border-border bg-[#0F1115] rounded-sm overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border">
                <th className="text-left px-4 sm:px-6 py-3">Vehicle</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden sm:table-cell">Type</th>
                <th className="text-left px-4 sm:px-6 py-3">Owner</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden md:table-cell">Mobile</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden md:table-cell">Plate</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden lg:table-cell">Year</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden lg:table-cell">Color</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden lg:table-cell">Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map(v => {
                const c = customers[v.customer_id];
                return (
                  <tr key={v.id} className="border-b border-border/60 hover:bg-white/[0.02]">
                    <td className="px-4 sm:px-6 py-3 font-semibold">{v.make} {v.model}</td>
                    <td className="px-4 sm:px-6 py-3 capitalize hidden sm:table-cell">{v.vehicle_type}</td>
                    <td className="px-4 sm:px-6 py-3 text-muted-foreground">{c?.name || "—"}</td>
                    <td className="px-4 sm:px-6 py-3 font-mono-data text-muted-foreground hidden md:table-cell">{c?.mobile || "—"}</td>
                    <td className="px-4 sm:px-6 py-3 font-mono-data hidden md:table-cell">{v.plate || "—"}</td>
                    <td className="px-4 sm:px-6 py-3 hidden lg:table-cell">{v.year || "—"}</td>
                    <td className="px-4 sm:px-6 py-3 hidden lg:table-cell">{v.color || "—"}</td>
                    <td className="px-4 sm:px-6 py-3 text-muted-foreground hidden lg:table-cell">{v.created_at ? fmtDate(v.created_at) : "—"}</td>
                    <td className="px-4 sm:px-6 py-3 text-right"><Link to={`/vehicles/${v.id}`} className="text-[#3385FF] text-xs hover:underline">Open →</Link></td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">No vehicles matching filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
