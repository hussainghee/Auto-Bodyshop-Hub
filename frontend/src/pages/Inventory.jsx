import { useEffect, useState } from "react";
import { api, fmtKWD } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const empty = { sku: "", name: "", category: "", unit: "pcs", cost_price: 0, selling_price: 0, stock_qty: 0, low_stock_threshold: 5 };

export default function Inventory() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = async () => setList((await api.get("/inventory")).data);
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, cost_price: Number(form.cost_price), selling_price: Number(form.selling_price), stock_qty: Number(form.stock_qty), low_stock_threshold: Number(form.low_stock_threshold) };
      if (editId) await api.patch(`/inventory/${editId}`, payload);
      else await api.post("/inventory", payload);
      toast.success("Saved");
      setOpen(false); setForm(empty); setEditId(null); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const startEdit = (it) => { setForm(it); setEditId(it.id); setOpen(true); };

  return (
    <div data-testid="inventory-page">
      <PageHeader title="Inventory" subtitle="Stock"
        actions={<Button onClick={() => { setForm(empty); setEditId(null); setOpen(true); }} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="new-inv-btn"><Plus size={16} className="mr-1.5" /> New Item</Button>}
      />
      <div className="p-8">
        <div className="border border-border bg-[#0F1115] rounded-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border"><th className="text-left px-6 py-3">SKU</th><th className="text-left px-6 py-3">Name</th><th className="text-left px-6 py-3">Category</th><th className="text-left px-6 py-3">Unit</th><th className="text-right px-6 py-3">Cost</th><th className="text-right px-6 py-3">Selling</th><th className="text-right px-6 py-3">Stock</th><th /></tr>
            </thead>
            <tbody>
              {list.map(it => {
                const low = it.stock_qty <= it.low_stock_threshold;
                return (
                  <tr key={it.id} className="border-b border-border/60 hover:bg-white/[0.02]">
                    <td className="px-6 py-3 font-mono-data">{it.sku}</td>
                    <td className="px-6 py-3 font-semibold">{it.name}</td>
                    <td className="px-6 py-3 text-muted-foreground">{it.category}</td>
                    <td className="px-6 py-3 text-muted-foreground">{it.unit}</td>
                    <td className="px-6 py-3 text-right font-mono-data">{fmtKWD(it.cost_price)}</td>
                    <td className="px-6 py-3 text-right font-mono-data">{fmtKWD(it.selling_price)}</td>
                    <td className={`px-6 py-3 text-right font-mono-data ${low ? "text-[#FFCC00]" : ""}`}>
                      {low && <AlertTriangle size={12} className="inline mr-1" />}
                      {it.stock_qty}
                    </td>
                    <td className="px-6 py-3 text-right"><button onClick={() => startEdit(it)} className="text-[#3385FF] text-xs hover:underline">Edit</button></td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">No items.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">{editId ? "Edit Item" : "New Item"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3 mt-2" data-testid="inv-form">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[10px] uppercase tracking-wider">SKU *</Label><Input required value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Name *</Label><Input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Category</Label><Input value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Unit</Label><Input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Cost Price</Label><Input type="number" step="0.001" value={form.cost_price} onChange={e => setForm({...form, cost_price: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Selling Price</Label><Input type="number" step="0.001" value={form.selling_price} onChange={e => setForm({...form, selling_price: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Stock Qty</Label><Input type="number" step="1" value={form.stock_qty} onChange={e => setForm({...form, stock_qty: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Low Stock Threshold</Label><Input type="number" step="1" value={form.low_stock_threshold} onChange={e => setForm({...form, low_stock_threshold: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
            </div>
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
