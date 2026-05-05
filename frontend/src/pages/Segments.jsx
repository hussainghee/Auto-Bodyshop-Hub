import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDate, API } from "../lib/api";
import PageHeader from "../components/PageHeader";
import MultiSelectCombobox from "../components/MultiSelectCombobox";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, Download, Trash2, Users, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const emptyFilters = {
  makes: [], models: [], years: [], colors: [], vehicle_types: [], cities: [],
  created_after: "", created_before: "",
  has_vehicles: null, recent_days: "",
  last_service_after: "", last_service_before: "",
  min_total_spend: "", max_total_spend: "",
  min_job_count: "", max_job_count: "",
};

export default function Segments() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [preview, setPreview] = useState(null);
  const [vts, setVts] = useState([]);
  const [makes, setMakes] = useState([]);

  const load = async () => setList((await api.get("/segments")).data);
  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.get("/vehicle-types").then(r => setVts(r.data));
    api.get("/vehicle-makes").then(r => setMakes(r.data));
  }, []);

  // Models depend on selected makes; if no makes selected, show all models
  const modelOptions = useMemo(() => {
    if (filters.makes.length === 0) {
      const all = makes.flatMap(m => m.models || []);
      return Array.from(new Set(all)).sort();
    }
    const sel = makes.filter(m => filters.makes.includes(m.label));
    const merged = sel.flatMap(m => m.models || []);
    return Array.from(new Set(merged)).sort();
  }, [filters.makes, makes]);

  // Year choices: a sensible recent range
  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear();
    return Array.from({ length: 30 }, (_, i) => String(cur - i));
  }, []);

  const buildPayload = () => {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v === "" || v === null || v === undefined) return;
      if (Array.isArray(v)) {
        if (v.length === 0) return;
        if (k === "years") p[k] = v.map(x => parseInt(x));
        else p[k] = v;
        return;
      }
      if (["recent_days", "min_job_count", "max_job_count"].includes(k)) p[k] = parseInt(v);
      else if (["min_total_spend", "max_total_spend"].includes(k)) p[k] = parseFloat(v);
      else p[k] = v;
    });
    return p;
  };

  const runPreview = async () => {
    try {
      const { data } = await api.post("/segments/preview", buildPayload());
      setPreview(data);
    } catch (err) { toast.error(err?.response?.data?.detail || "Preview failed"); }
  };

  const openNew = () => {
    setName(""); setDescription(""); setFilters(emptyFilters); setPreview(null); setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Segment name required"); return; }
    try {
      await api.post("/segments", {
        name: name.trim(),
        description: description.trim() || null,
        filters: buildPayload(),
      });
      toast.success("Segment saved");
      setOpen(false); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const deleteSeg = async (e, id) => {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm("Delete this segment?")) return;
    try { await api.delete(`/segments/${id}`); load(); toast.success("Deleted"); }
    catch { toast.error("Delete failed (admin-only)"); }
  };

  const exportSeg = async (e, id, n) => {
    e.preventDefault(); e.stopPropagation();
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API}/segments/${id}/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `segment_${n.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().slice(0,10)}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Export failed"); }
  };

  const cityOptions = useMemo(() => ["Salmiya", "Hawalli", "Kuwait City", "Farwaniya", "Jahra", "Ahmadi", "Mubarak Al-Kabeer"], []);

  return (
    <div data-testid="segments-page">
      <PageHeader title="Segments" subtitle="Customer Targeting"
        actions={<Button onClick={openNew} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="new-segment-btn"><Plus size={16} className="mr-1.5" /> New Segment</Button>}
      />
      <div className="p-4 sm:p-8 space-y-3">
        {list.map(s => (
          <Link key={s.id} to={`/customers/segments/${s.id}`} className="block">
            <div className="border border-border bg-[#0F1115] rounded-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 hover:border-[#0066FF]/40 transition-colors" data-testid={`segment-${s.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-display text-lg sm:text-xl font-bold">{s.name}</div>
                  <span className="text-[10px] uppercase tracking-widest border border-border px-2 py-0.5 rounded-sm text-muted-foreground flex items-center gap-1"><Users size={10} />{s.customer_count || 0}</span>
                </div>
                {s.description && <div className="text-sm text-muted-foreground mt-1">{s.description}</div>}
                <div className="text-[11px] text-muted-foreground mt-2 flex gap-4 flex-wrap">
                  <span>Created {fmtDate(s.created_at)}</span>
                  {s.created_by_name && <span>By {s.created_by_name}</span>}
                </div>
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  {Object.entries(s.filters || {}).filter(([, v]) => v !== null && v !== "" && v !== undefined && !(Array.isArray(v) && v.length === 0)).slice(0, 8).map(([k, v]) => (
                    <span key={k} className="text-[11px] border border-[#0066FF]/40 bg-[#0066FF]/10 text-[#3385FF] rounded-sm px-2 py-0.5 font-mono-data truncate max-w-[260px]">{k}: {Array.isArray(v) ? v.join("/") : String(v)}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 items-center self-start sm:self-center">
                <Button size="sm" variant="outline" onClick={(e) => exportSeg(e, s.id, s.name)} className="border-border rounded-sm" data-testid={`export-segment-${s.id}`}><Download size={12} className="mr-1" /> Export</Button>
                <button onClick={(e) => deleteSeg(e, s.id)} className="text-muted-foreground hover:text-[#FF3B30] p-2" data-testid={`delete-segment-${s.id}`}><Trash2 size={14} /></button>
                <ChevronRight size={16} className="text-muted-foreground hidden sm:block" />
              </div>
            </div>
          </Link>
        ))}
        {list.length === 0 && <div className="text-center text-muted-foreground py-16">No segments yet. Click "New Segment" to create one.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-4xl max-h-[92vh] overflow-y-auto w-[calc(100vw-1.5rem)] sm:w-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">New Segment</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2" data-testid="segment-form">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-[10px] uppercase tracking-wider">Name *</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1 bg-background border-border rounded-sm" data-testid="segment-name" placeholder="e.g. Toyota SUV Owners – Salmiya" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} className="mt-1 bg-background border-border rounded-sm" data-testid="segment-description" /></div>
            </div>

            <div className="border border-border rounded-sm p-3 sm:p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Vehicle Filters</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Label className="text-[10px] uppercase">Brands</Label>
                  <div className="mt-1"><MultiSelectCombobox testId="filter-makes" options={makes.map(m => m.label)} values={filters.makes} onChange={(v) => setFilters({ ...filters, makes: v, models: [] })} placeholder="Any brand" /></div>
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Models</Label>
                  <div className="mt-1"><MultiSelectCombobox testId="filter-models" options={modelOptions} values={filters.models} onChange={(v) => setFilters({ ...filters, models: v })} placeholder={filters.makes.length ? "Any model" : "Search any model"} /></div>
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Years</Label>
                  <div className="mt-1"><MultiSelectCombobox testId="filter-years" options={yearOptions} values={filters.years.map(String)} onChange={(v) => setFilters({ ...filters, years: v })} placeholder="Any year" /></div>
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Colors</Label>
                  <div className="mt-1"><MultiSelectCombobox testId="filter-colors" options={["Black","White","Silver","Grey","Red","Blue","Brown","Beige","Gold","Green"]} values={filters.colors} onChange={(v) => setFilters({ ...filters, colors: v })} placeholder="Any color" /></div>
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Types</Label>
                  <div className="mt-1"><MultiSelectCombobox testId="filter-types" options={vts.map(t => ({ value: t.key, label: t.label }))} values={filters.vehicle_types} onChange={(v) => setFilters({ ...filters, vehicle_types: v })} placeholder="Any type" /></div>
                </div>
                <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-4 pt-1 sm:pt-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={filters.has_vehicles === true} onCheckedChange={(v) => setFilters({ ...filters, has_vehicles: v ? true : null })} className="border-border" />
                    Has vehicle(s)
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={filters.has_vehicles === false} onCheckedChange={(v) => setFilters({ ...filters, has_vehicles: v ? false : null })} className="border-border" />
                    No vehicles
                  </label>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-sm p-3 sm:p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Customer Filters</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div><Label className="text-[10px] uppercase">Registered from</Label><Input type="date" value={filters.created_after} onChange={e => setFilters({ ...filters, created_after: e.target.value })} className="mt-1 bg-background border-border rounded-sm" data-testid="filter-registered-from" /></div>
                <div><Label className="text-[10px] uppercase">Registered to</Label><Input type="date" value={filters.created_before} onChange={e => setFilters({ ...filters, created_before: e.target.value })} className="mt-1 bg-background border-border rounded-sm" data-testid="filter-registered-to" /></div>
                <div>
                  <Label className="text-[10px] uppercase">Cities / Areas</Label>
                  <div className="mt-1"><MultiSelectCombobox testId="filter-cities" options={cityOptions} values={filters.cities} onChange={(v) => setFilters({ ...filters, cities: v })} placeholder="Any city" /></div>
                </div>
                <div><Label className="text-[10px] uppercase">Recent (days)</Label><Input type="text" inputMode="numeric" pattern="[0-9]*" value={filters.recent_days} onChange={e => setFilters({ ...filters, recent_days: e.target.value.replace(/\D/g, "") })} className="mt-1 bg-background border-border rounded-sm" placeholder="e.g. 30" /></div>
              </div>
            </div>

            <div className="border border-border rounded-sm p-3 sm:p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Behaviour Filters (Jobs / Spend)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div><Label className="text-[10px] uppercase">Last service from</Label><Input type="date" value={filters.last_service_after} onChange={e => setFilters({ ...filters, last_service_after: e.target.value })} className="mt-1 bg-background border-border rounded-sm" data-testid="filter-last-service-after" /></div>
                <div><Label className="text-[10px] uppercase">Last service to</Label><Input type="date" value={filters.last_service_before} onChange={e => setFilters({ ...filters, last_service_before: e.target.value })} className="mt-1 bg-background border-border rounded-sm" data-testid="filter-last-service-before" /></div>
                <div className="hidden lg:block" />
                <div><Label className="text-[10px] uppercase">Min total spend (KWD)</Label><Input type="text" inputMode="decimal" value={filters.min_total_spend} onChange={e => setFilters({ ...filters, min_total_spend: e.target.value.replace(/[^0-9.]/g, "") })} className="mt-1 bg-background border-border rounded-sm" data-testid="filter-min-spend" /></div>
                <div><Label className="text-[10px] uppercase">Max total spend (KWD)</Label><Input type="text" inputMode="decimal" value={filters.max_total_spend} onChange={e => setFilters({ ...filters, max_total_spend: e.target.value.replace(/[^0-9.]/g, "") })} className="mt-1 bg-background border-border rounded-sm" data-testid="filter-max-spend" /></div>
                <div className="hidden lg:block" />
                <div><Label className="text-[10px] uppercase">Min job count</Label><Input type="text" inputMode="numeric" pattern="[0-9]*" value={filters.min_job_count} onChange={e => setFilters({ ...filters, min_job_count: e.target.value.replace(/\D/g, "") })} className="mt-1 bg-background border-border rounded-sm" data-testid="filter-min-jobs" /></div>
                <div><Label className="text-[10px] uppercase">Max job count</Label><Input type="text" inputMode="numeric" pattern="[0-9]*" value={filters.max_job_count} onChange={e => setFilters({ ...filters, max_job_count: e.target.value.replace(/\D/g, "") })} className="mt-1 bg-background border-border rounded-sm" data-testid="filter-max-jobs" /></div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={runPreview} variant="outline" className="border-[#0066FF]/40 text-[#3385FF] rounded-sm" data-testid="preview-btn">Preview Customers</Button>
              {preview && <div className="text-sm text-muted-foreground">Matching: <span className="text-white font-semibold">{preview.count}</span></div>}
            </div>

            {preview && preview.customers.length > 0 && (
              <div className="border border-border rounded-sm max-h-56 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
                    <tr className="border-b border-border"><th className="text-left px-3 py-2">Name</th><th className="text-left px-3 py-2">Mobile</th><th className="text-left px-3 py-2 hidden sm:table-cell">City</th><th className="text-right px-3 py-2 hidden sm:table-cell">Jobs</th><th className="text-right px-3 py-2">Spend (KWD)</th><th className="text-left px-3 py-2 hidden md:table-cell">Last Service</th></tr>
                  </thead>
                  <tbody data-testid="preview-list">
                    {preview.customers.map(c => (
                      <tr key={c.id} className="border-b border-border/60">
                        <td className="px-3 py-1.5">{c.name}</td>
                        <td className="px-3 py-1.5 font-mono-data text-muted-foreground">{c.mobile}</td>
                        <td className="px-3 py-1.5 text-muted-foreground hidden sm:table-cell">{c.city || "—"}</td>
                        <td className="px-3 py-1.5 text-right font-mono-data hidden sm:table-cell">{c.job_count ?? "—"}</td>
                        <td className="px-3 py-1.5 text-right font-mono-data">{c.total_spend != null ? c.total_spend.toFixed(3) : "—"}</td>
                        <td className="px-3 py-1.5 text-muted-foreground hidden md:table-cell">{c.last_service ? fmtDate(c.last_service) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter className="pt-3 border-t border-border flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border rounded-sm">Cancel</Button>
            <Button onClick={save} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="save-segment-btn">Save Segment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
