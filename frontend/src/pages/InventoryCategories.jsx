import { useEffect, useState, useMemo } from "react";
import { api, fmtDate, API } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, Download, Edit3, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", description: "", active: true };

export default function InventoryCategories() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = async () => {
    const { data } = await api.get("/inventory-categories", { params: q ? { q } : {} });
    setList(data);
  };
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.patch(`/inventory-categories/${editId}`, form);
      else await api.post("/inventory-categories", form);
      toast.success("Saved");
      setOpen(false); setForm(empty); setEditId(null); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const startEdit = (c) => { setForm({ name: c.name, description: c.description || "", active: c.active !== false }); setEditId(c.id); setOpen(true); };

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try { await api.delete(`/inventory-categories/${c.id}`); toast.success("Deleted"); load(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const exportXlsx = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const url = q ? `${API}/export/inventory-categories?q=${encodeURIComponent(q)}` : `${API}/export/inventory-categories`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `inventory_categories_${new Date().toISOString().slice(0,10)}.xlsx`; a.click();
      toast.success("Exported");
    } catch { toast.error("Export failed"); }
  };

  const summary = useMemo(() => ({
    total: list.length,
    active: list.filter(c => c.active !== false).length,
    products: list.reduce((s, c) => s + (c.product_count || 0), 0),
  }), [list]);

  return (
    <div data-testid="inv-categories-page">
      <PageHeader title="Inventory Categories" subtitle="Stock"
        actions={<>
          <Button variant="outline" onClick={exportXlsx} className="border-border rounded-sm" data-testid="export-inv-cats"><Download size={14} className="mr-1.5" /> Export</Button>
          <Button onClick={() => { setForm(empty); setEditId(null); setOpen(true); }} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="new-inv-cat-btn"><Plus size={16} className="mr-1.5" /> New Category</Button>
        </>}
      />
      <div className="p-4 sm:p-8 space-y-4">
        <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-2xl">
          <Stat label="Categories" value={summary.total} />
          <Stat label="Active" value={summary.active} />
          <Stat label="Products" value={summary.products} />
        </div>
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search categories…" value={q} onChange={e => setQ(e.target.value)} className="pl-9 bg-[#0F1115] border-border rounded-sm h-10" data-testid="inv-cat-search" />
        </div>
        <div className="border border-border bg-[#0F1115] rounded-sm overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border">
                <th className="text-left px-4 sm:px-6 py-3">Name</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden md:table-cell">Description</th>
                <th className="text-left px-4 sm:px-6 py-3">Status</th>
                <th className="text-right px-4 sm:px-6 py-3">Products</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden lg:table-cell">Created By</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden lg:table-cell">Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id} className="border-b border-border/60 hover:bg-white/[0.02]" data-testid={`inv-cat-row-${c.id}`}>
                  <td className="px-4 sm:px-6 py-3 font-semibold">{c.name}{c.is_default && <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">default</span>}</td>
                  <td className="px-4 sm:px-6 py-3 text-muted-foreground hidden md:table-cell">{c.description || "—"}</td>
                  <td className="px-4 sm:px-6 py-3">
                    <span className={`text-[10px] uppercase tracking-widest border rounded-sm px-2 py-0.5 ${c.active !== false ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5" : "border-border text-muted-foreground"}`}>{c.active !== false ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-right font-mono-data">{c.product_count || 0}</td>
                  <td className="px-4 sm:px-6 py-3 text-muted-foreground hidden lg:table-cell">{c.created_by_name || "—"}</td>
                  <td className="px-4 sm:px-6 py-3 text-muted-foreground hidden lg:table-cell">{c.created_at ? fmtDate(c.created_at) : "—"}</td>
                  <td className="px-4 sm:px-6 py-3 text-right">
                    <button onClick={() => startEdit(c)} className="text-[#3385FF] text-xs hover:underline mr-3" data-testid={`edit-inv-cat-${c.id}`}><Edit3 size={12} className="inline mr-1" />Edit</button>
                    {!c.is_default && <button onClick={() => remove(c)} className="text-[#FF3B30] text-xs hover:underline" data-testid={`del-inv-cat-${c.id}`}><Trash2 size={12} className="inline mr-1" />Delete</button>}
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No categories. Click "New Category" to create one.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-lg w-[calc(100vw-1.5rem)] sm:w-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">{editId ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3 mt-2" data-testid="inv-cat-form">
            <div><Label className="text-[10px] uppercase tracking-wider">Name *</Label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 bg-background border-border rounded-sm" data-testid="inv-cat-name" autoFocus /></div>
            <div><Label className="text-[10px] uppercase tracking-wider">Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 bg-background border-border rounded-sm" data-testid="inv-cat-description" /></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: !!v })} className="border-border" data-testid="inv-cat-active" />
              Active
            </label>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button type="submit" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="inv-cat-save">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Stat = ({ label, value }) => (
  <div className="border border-border bg-[#0F1115] rounded-sm px-4 py-3">
    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
    <div className="font-display text-2xl font-black mt-1 font-mono-data">{value}</div>
  </div>
);
