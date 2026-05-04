import { useEffect, useState } from "react";
import { api, fmtDate, fmtDateTime, API } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, Download, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

const emptyFilters = {
  make: "", model: "", year_min: "", year_max: "", color: "", vehicle_type: "",
  created_after: "", created_before: "", city: "",
  has_vehicles: null, recent_days: "",
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

  const selectedMake = makes.find(m => m.label === filters.make);

  const buildPayload = () => {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v === "" || v === null || v === undefined) return;
      if (["year_min", "year_max", "recent_days"].includes(k)) p[k] = parseInt(v);
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

  const deleteSeg = async (id) => {
    if (!window.confirm("Delete this segment?")) return;
    try { await api.delete(`/segments/${id}`); load(); toast.success("Deleted"); }
    catch { toast.error("Delete failed (admin-only)"); }
  };

  const exportSeg = async (id, n) => {
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

  return (
    <div data-testid="segments-page">
      <PageHeader title="Segments" subtitle="Customer Targeting"
        actions={<Button onClick={openNew} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="new-segment-btn"><Plus size={16} className="mr-1.5" /> New Segment</Button>}
      />
      <div className="p-8 space-y-3">
        {list.map(s => (
          <div key={s.id} className="border border-border bg-[#0F1115] rounded-sm p-5 flex items-start justify-between" data-testid={`segment-${s.id}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-display text-xl font-bold">{s.name}</div>
                <span className="text-[10px] uppercase tracking-widest border border-border px-2 py-0.5 rounded-sm text-muted-foreground flex items-center gap-1"><Users size={10} />{s.customer_count || 0}</span>
              </div>
              {s.description && <div className="text-sm text-muted-foreground mt-1">{s.description}</div>}
              <div className="text-[11px] text-muted-foreground mt-2 flex gap-4 flex-wrap">
                <span>Created {fmtDate(s.created_at)}</span>
                {s.created_by_name && <span>By {s.created_by_name}</span>}
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                {Object.entries(s.filters || {}).filter(([, v]) => v !== null && v !== "" && v !== undefined).map(([k, v]) => (
                  <span key={k} className="text-[11px] border border-[#0066FF]/40 bg-[#0066FF]/10 text-[#3385FF] rounded-sm px-2 py-0.5 font-mono-data">{k}: {String(v)}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => exportSeg(s.id, s.name)} className="border-border rounded-sm" data-testid={`export-segment-${s.id}`}><Download size={12} className="mr-1" /> Export</Button>
              <button onClick={() => deleteSeg(s.id)} className="text-muted-foreground hover:text-[#FF3B30] p-2"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="text-center text-muted-foreground py-16">No segments yet. Click "New Segment" to create one.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">New Segment</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2" data-testid="segment-form">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[10px] uppercase tracking-wider">Name *</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1 bg-background border-border rounded-sm" data-testid="segment-name" placeholder="e.g. Toyota SUV Owners – Salmiya" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} className="mt-1 bg-background border-border rounded-sm" /></div>
            </div>

            <div className="border border-border rounded-sm p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Vehicle Filters</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-[10px] uppercase">Brand</Label>
                  <Select value={filters.make || "__all__"} onValueChange={(v) => setFilters({ ...filters, make: v === "__all__" ? "" : v, model: "" })}>
                    <SelectTrigger className="mt-1 bg-background border-border rounded-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent className="bg-[#0F1115] border-border max-h-[280px]">
                      <SelectItem value="__all__">Any</SelectItem>
                      {makes.map(m => <SelectItem key={m.id} value={m.label}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Model</Label>
                  <Select value={filters.model || "__all__"} onValueChange={(v) => setFilters({ ...filters, model: v === "__all__" ? "" : v })} disabled={!selectedMake}>
                    <SelectTrigger className="mt-1 bg-background border-border rounded-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent className="bg-[#0F1115] border-border max-h-[280px]">
                      <SelectItem value="__all__">Any</SelectItem>
                      {(selectedMake?.models || []).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-[10px] uppercase">Year from</Label><Input type="number" value={filters.year_min} onChange={e => setFilters({ ...filters, year_min: e.target.value })} className="mt-1 bg-background border-border rounded-sm" /></div>
                <div><Label className="text-[10px] uppercase">Year to</Label><Input type="number" value={filters.year_max} onChange={e => setFilters({ ...filters, year_max: e.target.value })} className="mt-1 bg-background border-border rounded-sm" /></div>
                <div><Label className="text-[10px] uppercase">Color</Label><Input value={filters.color} onChange={e => setFilters({ ...filters, color: e.target.value })} className="mt-1 bg-background border-border rounded-sm" /></div>
                <div>
                  <Label className="text-[10px] uppercase">Type</Label>
                  <Select value={filters.vehicle_type || "__all__"} onValueChange={(v) => setFilters({ ...filters, vehicle_type: v === "__all__" ? "" : v })}>
                    <SelectTrigger className="mt-1 bg-background border-border rounded-sm"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent className="bg-[#0F1115] border-border">
                      <SelectItem value="__all__">Any</SelectItem>
                      {vts.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex items-center gap-4 pt-6">
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

            <div className="border border-border rounded-sm p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Customer Filters</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Label className="text-[10px] uppercase">Registered from</Label><Input type="date" value={filters.created_after} onChange={e => setFilters({ ...filters, created_after: e.target.value })} className="mt-1 bg-background border-border rounded-sm" /></div>
                <div><Label className="text-[10px] uppercase">Registered to</Label><Input type="date" value={filters.created_before} onChange={e => setFilters({ ...filters, created_before: e.target.value })} className="mt-1 bg-background border-border rounded-sm" /></div>
                <div><Label className="text-[10px] uppercase">City / Area</Label><Input value={filters.city} onChange={e => setFilters({ ...filters, city: e.target.value })} className="mt-1 bg-background border-border rounded-sm" placeholder="e.g. Salmiya" /></div>
                <div><Label className="text-[10px] uppercase">Recent (days)</Label><Input type="number" value={filters.recent_days} onChange={e => setFilters({ ...filters, recent_days: e.target.value })} className="mt-1 bg-background border-border rounded-sm" placeholder="e.g. 30" /></div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" onClick={runPreview} variant="outline" className="border-[#0066FF]/40 text-[#3385FF] rounded-sm" data-testid="preview-btn">Preview Customers</Button>
              {preview && <div className="text-sm text-muted-foreground">Matching: <span className="text-white font-semibold">{preview.count}</span></div>}
            </div>

            {preview && preview.customers.length > 0 && (
              <div className="border border-border rounded-sm max-h-56 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
                    <tr className="border-b border-border"><th className="text-left px-3 py-2">Name</th><th className="text-left px-3 py-2">Mobile</th><th className="text-left px-3 py-2">City</th><th className="text-left px-3 py-2">Registered</th></tr>
                  </thead>
                  <tbody data-testid="preview-list">
                    {preview.customers.map(c => (
                      <tr key={c.id} className="border-b border-border/60"><td className="px-3 py-1.5">{c.name}</td><td className="px-3 py-1.5 font-mono-data text-muted-foreground">{c.mobile}</td><td className="px-3 py-1.5 text-muted-foreground">{c.city || "—"}</td><td className="px-3 py-1.5 text-muted-foreground">{c.created_at ? fmtDateTime(c.created_at) : "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter className="pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border rounded-sm">Cancel</Button>
            <Button onClick={save} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="save-segment-btn">Save Segment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
