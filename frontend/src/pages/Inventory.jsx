import { useEffect, useMemo, useState } from "react";
import { api, fmtKWD, fmtDate, API } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, AlertTriangle, Download, Search, Filter, X, Edit3 } from "lucide-react";
import { toast } from "sonner";

const empty = {
  sku: "", name: "", category_id: "", unit: "pcs",
  cost_price: 0, selling_price: 0, stock_qty: 0,
  reorder_level: 5, low_stock_threshold: 5,
  active: true,
};

export default function Inventory() {
  const [list, setList] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    if (categoryFilter !== "all") params.category_id = categoryFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    const { data } = await api.get("/inventory", { params });
    setList(data);
  };
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q, categoryFilter, statusFilter]);
  useEffect(() => { api.get("/inventory-categories").then(r => setCats(r.data)); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        cost_price: Number(form.cost_price),
        selling_price: Number(form.selling_price),
        stock_qty: Number(form.stock_qty),
        reorder_level: Number(form.reorder_level),
        low_stock_threshold: Number(form.reorder_level),
        category_id: form.category_id || null,
        category: cats.find(c => c.id === form.category_id)?.name || form.category || "",
      };
      if (editId) await api.patch(`/inventory/${editId}`, payload);
      else await api.post("/inventory", payload);
      toast.success("Saved");
      setOpen(false); setForm(empty); setEditId(null); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const startEdit = (it) => {
    setForm({
      sku: it.sku || "", name: it.name || "",
      category_id: it.category_id || "",
      unit: it.unit || "pcs",
      cost_price: it.cost_price || 0,
      selling_price: it.selling_price || 0,
      stock_qty: it.stock_qty || 0,
      reorder_level: it.reorder_level ?? it.low_stock_threshold ?? 5,
      low_stock_threshold: it.low_stock_threshold ?? 5,
      active: it.active !== false,
    });
    setEditId(it.id); setOpen(true);
  };

  const exportXlsx = async () => {
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (categoryFilter !== "all") params.set("category_id", categoryFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API}/export/inventory?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const cn = categoryFilter !== "all" ? "_" + (cats.find(c => c.id === categoryFilter)?.name || "") : "";
      a.download = `inventory${cn}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      toast.success("Exported");
    } catch { toast.error("Export failed"); }
  };

  const activeFilters = (categoryFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);

  const summary = useMemo(() => {
    const total = list.length;
    const low = list.filter(i => (i.stock_qty || 0) <= (i.reorder_level || 0)).length;
    const value = list.reduce((s, i) => s + (i.stock_qty || 0) * (i.cost_price || 0), 0);
    return { total, low, value };
  }, [list]);

  return (
    <div data-testid="inventory-page">
      <PageHeader title="Products" subtitle="Inventory"
        actions={<>
          <Button variant="outline" onClick={exportXlsx} className="border-border rounded-sm" data-testid="export-inventory"><Download size={14} className="mr-1.5" /> Export</Button>
          <Button onClick={() => { setForm(empty); setEditId(null); setOpen(true); }} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="new-inv-btn"><Plus size={16} className="mr-1.5" /> New Product</Button>
        </>}
      />
      <div className="p-4 sm:p-8 space-y-4">
        <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-2xl">
          <Stat label="Products" value={summary.total} />
          <Stat label="Low Stock" value={summary.low} accent={summary.low > 0 ? "#FFCC00" : null} />
          <Stat label="Stock Value (KWD)" value={fmtKWD(summary.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search SKU, name, category, price…" value={q} onChange={e => setQ(e.target.value)} className="pl-9 bg-[#0F1115] border-border rounded-sm h-10" data-testid="inv-search" />
          </div>
          {activeFilters > 0 && (
            <Button variant="outline" size="sm" onClick={() => { setCategoryFilter("all"); setStatusFilter("all"); }} className="border-border rounded-sm"><X size={12} className="mr-1" /> Clear filters</Button>
          )}
        </div>
        <div className="border border-border bg-[#0F1115] rounded-sm p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3"><Filter size={14} className="text-muted-foreground" /><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Filters</div></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="mt-1 bg-background border-border rounded-sm h-9" data-testid="inv-filter-category"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0F1115] border-border max-h-[280px]">
                  <SelectItem value="all">All categories</SelectItem>
                  {cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.product_count || 0})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1 bg-background border-border rounded-sm h-9" data-testid="inv-filter-status"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0F1115] border-border">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="border border-border bg-[#0F1115] rounded-sm overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border">
                <th className="text-left px-4 sm:px-6 py-3">SKU</th>
                <th className="text-left px-4 sm:px-6 py-3">Name</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden md:table-cell">Category</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden lg:table-cell">Unit</th>
                <th className="text-right px-4 sm:px-6 py-3 hidden md:table-cell">Cost</th>
                <th className="text-right px-4 sm:px-6 py-3">Selling</th>
                <th className="text-right px-4 sm:px-6 py-3">Stock</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden lg:table-cell">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map(it => {
                const reorder = it.reorder_level ?? it.low_stock_threshold ?? 0;
                const low = it.stock_qty <= reorder;
                return (
                  <tr key={it.id} className="border-b border-border/60 hover:bg-white/[0.02]" data-testid={`inv-row-${it.id}`}>
                    <td className="px-4 sm:px-6 py-3 font-mono-data">{it.sku}</td>
                    <td className="px-4 sm:px-6 py-3 font-semibold">{it.name}</td>
                    <td className="px-4 sm:px-6 py-3 text-muted-foreground hidden md:table-cell">{it.category_name || it.category || "—"}</td>
                    <td className="px-4 sm:px-6 py-3 text-muted-foreground hidden lg:table-cell">{it.unit}</td>
                    <td className="px-4 sm:px-6 py-3 text-right font-mono-data hidden md:table-cell">{fmtKWD(it.cost_price)}</td>
                    <td className="px-4 sm:px-6 py-3 text-right font-mono-data">{fmtKWD(it.selling_price)}</td>
                    <td className={`px-4 sm:px-6 py-3 text-right font-mono-data ${low ? "text-[#FFCC00]" : ""}`}>
                      {low && <AlertTriangle size={12} className="inline mr-1" />}
                      {it.stock_qty}
                    </td>
                    <td className="px-4 sm:px-6 py-3 hidden lg:table-cell">
                      <span className={`text-[10px] uppercase tracking-widest border rounded-sm px-2 py-0.5 ${it.active !== false ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5" : "border-border text-muted-foreground"}`}>{it.active !== false ? "Active" : "Inactive"}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-right"><button onClick={() => startEdit(it)} className="text-[#3385FF] text-xs hover:underline" data-testid={`edit-inv-${it.id}`}><Edit3 size={12} className="inline mr-1" />Edit</button></td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">No products match. Click "New Product" to add one.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-2xl w-[calc(100vw-1.5rem)] sm:w-auto max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">{editId ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3 mt-2" data-testid="inv-form">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-[10px] uppercase tracking-wider">SKU *</Label><Input required value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="mt-1 bg-background border-border rounded-sm" data-testid="inv-sku" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Name *</Label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 bg-background border-border rounded-sm" data-testid="inv-name" /></div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider">Category *</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger className="mt-1 bg-background border-border rounded-sm" data-testid="inv-category"><SelectValue placeholder="Choose category" /></SelectTrigger>
                  <SelectContent className="bg-[#0F1115] border-border max-h-[280px]">
                    {cats.filter(c => c.active !== false).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-[10px] uppercase tracking-wider">Unit of Measure</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="mt-1 bg-background border-border rounded-sm" placeholder="pcs / liter / meter" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Cost Price (KWD)</Label><Input type="text" inputMode="decimal" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value.replace(/[^0-9.]/g, "") })} className="mt-1 bg-background border-border rounded-sm" data-testid="inv-cost" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Selling Price (KWD)</Label><Input type="text" inputMode="decimal" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value.replace(/[^0-9.]/g, "") })} className="mt-1 bg-background border-border rounded-sm" data-testid="inv-selling" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Stock Qty</Label><Input type="text" inputMode="decimal" value={form.stock_qty} onChange={e => setForm({ ...form, stock_qty: e.target.value.replace(/[^0-9.]/g, "") })} className="mt-1 bg-background border-border rounded-sm" data-testid="inv-stock" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Reorder Level</Label><Input type="text" inputMode="decimal" value={form.reorder_level} onChange={e => setForm({ ...form, reorder_level: e.target.value.replace(/[^0-9.]/g, "") })} className="mt-1 bg-background border-border rounded-sm" data-testid="inv-reorder" /></div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: !!v })} className="border-border" data-testid="inv-active" />
              Active
            </label>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button type="submit" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="inv-save">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Stat = ({ label, value, accent }) => (
  <div className="border border-border bg-[#0F1115] rounded-sm px-4 py-3">
    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
    <div className="font-display text-2xl font-black mt-1 font-mono-data" style={accent ? { color: accent } : {}}>{value}</div>
  </div>
);
