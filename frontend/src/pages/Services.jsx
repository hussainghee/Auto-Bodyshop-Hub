import { useEffect, useState } from "react";
import { api, fmtKWD } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, Package } from "lucide-react";
import { toast } from "sonner";

const emptyForm = {
  name: "", category: "", category_id: "", pricing_mode: "fixed", description: "",
  fixed_price: 0, vehicle_type_prices: {}, panel_prices: {}, glass_prices: {}, full_vehicle_prices: {},
  is_bundle: false, bundle_items: [], active: true,
  requires_panel: null, requires_glass: null, applicable_vehicle_types: [],
};

const emptyCat = { name: "", description: "", active: true };

export default function Services() {
  const [tab, setTab] = useState("services");
  const [list, setList] = useState([]);
  const [cats, setCats] = useState([]);
  const [vts, setVts] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [bundleInput, setBundleInput] = useState("");

  // Service categories tab state
  const [catOpen, setCatOpen] = useState(false);
  const [catForm, setCatForm] = useState(emptyCat);
  const [catEditId, setCatEditId] = useState(null);

  const load = async () => {
    const [s, t, c] = await Promise.all([
      api.get("/services"), api.get("/vehicle-types"), api.get("/service-categories"),
    ]);
    setList(s.data); setVts(t.data); setCats(c.data);
  };
  useEffect(() => { load(); }, []);

  const catName = (id) => cats.find(c => c.id === id)?.name;

  const setVtPrice = (key, val) => setForm({...form, vehicle_type_prices: {...form.vehicle_type_prices, [key]: Number(val) || 0}});
  const setFullVehiclePrice = (key, val) => setForm({...form, full_vehicle_prices: {...form.full_vehicle_prices, [key]: Number(val) || 0}});
  const setPanelPrice = (vtKey, panelId, val) => setForm({
    ...form,
    panel_prices: { ...form.panel_prices, [vtKey]: { ...(form.panel_prices[vtKey] || {}), [panelId]: Number(val) || 0 } }
  });
  const setGlassPrice = (vtKey, glassId, val) => setForm({
    ...form,
    glass_prices: { ...form.glass_prices, [vtKey]: { ...(form.glass_prices[vtKey] || {}), [glassId]: Number(val) || 0 } }
  });

  const save = async (e) => {
    e.preventDefault();
    try {
      const cn = cats.find(c => c.id === form.category_id)?.name || form.category || "";
      const payload = {
        ...form,
        fixed_price: form.pricing_mode === "fixed" ? Number(form.fixed_price) : null,
        category: cn,  // keep legacy field populated for back-compat
        category_id: form.category_id || null,
        requires_panel: form.pricing_mode === "per_panel",
        requires_glass: form.pricing_mode === "per_glass_area",
      };
      if (editId) await api.patch(`/services/${editId}`, payload);
      else await api.post("/services", payload);
      toast.success("Saved");
      setOpen(false); setForm(emptyForm); setEditId(null); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const startEdit = (s) => { setForm({ ...emptyForm, ...s, category_id: s.category_id || "" }); setEditId(s.id); setOpen(true); };

  const saveCat = async (e) => {
    e.preventDefault();
    try {
      if (catEditId) await api.patch(`/service-categories/${catEditId}`, catForm);
      else await api.post("/service-categories", catForm);
      toast.success("Category saved");
      setCatOpen(false); setCatForm(emptyCat); setCatEditId(null); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };
  const startEditCat = (c) => { setCatForm({ name: c.name, description: c.description || "", active: c.active !== false }); setCatEditId(c.id); setCatOpen(true); };
  const removeCat = async (c) => {
    if (!window.confirm(`Delete category "${c.name}"?`)) return;
    try { await api.delete(`/service-categories/${c.id}`); toast.success("Deleted"); load(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const addBundleItem = () => {
    if (!bundleInput.trim()) return;
    setForm({ ...form, bundle_items: [...(form.bundle_items || []), bundleInput.trim()] });
    setBundleInput("");
  };

  return (
    <div data-testid="services-page">
      <PageHeader title="Services" subtitle="Catalog & Pricing"
        actions={
          tab === "services"
            ? <Button onClick={() => { setForm(emptyForm); setEditId(null); setOpen(true); }} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="new-service-btn"><Plus size={16} className="mr-1.5" /> New Service</Button>
            : <Button onClick={() => { setCatForm(emptyCat); setCatEditId(null); setCatOpen(true); }} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="new-svc-cat-btn"><Plus size={16} className="mr-1.5" /> New Category</Button>
        }
      />
      <div className="px-4 sm:px-8 pt-4 flex gap-2 border-b border-border" data-testid="services-tabs">
        <TabButton active={tab === "services"} onClick={() => setTab("services")} testid="tab-services">Services</TabButton>
        <TabButton active={tab === "categories"} onClick={() => setTab("categories")} testid="tab-svc-categories">Categories</TabButton>
      </div>

      {tab === "categories" && (
        <div className="p-4 sm:p-8">
          <div className="border border-border bg-[#0F1115] rounded-sm overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
                <tr className="border-b border-border">
                  <th className="text-left px-4 sm:px-6 py-3">Name</th>
                  <th className="text-left px-4 sm:px-6 py-3 hidden md:table-cell">Description</th>
                  <th className="text-left px-4 sm:px-6 py-3">Status</th>
                  <th className="text-right px-4 sm:px-6 py-3">Services</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cats.map(c => (
                  <tr key={c.id} className="border-b border-border/60 hover:bg-white/[0.02]" data-testid={`svc-cat-row-${c.id}`}>
                    <td className="px-4 sm:px-6 py-3 font-semibold">{c.name}</td>
                    <td className="px-4 sm:px-6 py-3 text-muted-foreground hidden md:table-cell">{c.description || "—"}</td>
                    <td className="px-4 sm:px-6 py-3">
                      <span className={`text-[10px] uppercase tracking-widest border rounded-sm px-2 py-0.5 ${c.active !== false ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5" : "border-border text-muted-foreground"}`}>{c.active !== false ? "Active" : "Inactive"}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-right font-mono-data">{c.service_count || 0}</td>
                    <td className="px-4 sm:px-6 py-3 text-right">
                      <button onClick={() => startEditCat(c)} className="text-[#3385FF] text-xs hover:underline mr-3" data-testid={`edit-svc-cat-${c.id}`}>Edit</button>
                      <button onClick={() => removeCat(c)} className="text-[#FF3B30] text-xs hover:underline" data-testid={`del-svc-cat-${c.id}`}>Delete</button>
                    </td>
                  </tr>
                ))}
                {cats.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No service categories yet. Create one to start grouping services.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "services" && (
      <div className="p-4 sm:p-8 space-y-3">
        {list.map(s => (
          <div key={s.id} className="border border-border bg-[#0F1115] rounded-sm p-4 sm:p-5 flex items-start justify-between gap-3 flex-col sm:flex-row" data-testid={`service-row-${s.id}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-display text-xl font-bold">{s.name}</div>
                {s.is_bundle && <span className="tag-status" style={{ color: "#FFCC00", background: "rgba(255,204,0,0.08)", borderColor: "#FFCC00" }}><Package size={10} className="inline mr-1" />BUNDLE</span>}
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border px-2 py-0.5 rounded-sm">{catName(s.category_id) || (s.category || "uncategorized").replace(/_/g, " ")}</span>
                <span className="text-[10px] uppercase tracking-widest text-[#3385FF] border border-[#0066FF]/40 bg-[#0066FF]/10 px-2 py-0.5 rounded-sm">{s.pricing_mode.replace(/_/g, " ")}</span>
                {s.active === false && <span className="tag-status border border-border text-muted-foreground">INACTIVE</span>}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{s.description || "—"}</div>
              {s.is_bundle && s.bundle_items?.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">Includes: {s.bundle_items.join(" · ")}</div>
              )}
              <div className="text-sm font-mono-data mt-2">
                {s.pricing_mode === "fixed" && fmtKWD(s.fixed_price)}
                {s.pricing_mode === "per_vehicle_type" && Object.entries(s.vehicle_type_prices || {}).map(([k, v]) => `${k}: ${fmtKWD(v)}`).join(" · ")}
                {s.pricing_mode === "full_vehicle" && Object.entries(s.full_vehicle_prices || {}).map(([k, v]) => `${k}: ${fmtKWD(v)}`).join(" · ")}
                {s.pricing_mode === "per_panel" && "Per-panel pricing configured"}
                {s.pricing_mode === "per_glass_area" && "Per-glass pricing configured"}
              </div>
            </div>
            <Button onClick={() => startEdit(s)} variant="outline" className="border-border rounded-sm self-start sm:self-center">Edit</Button>
          </div>
        ))}
        {list.length === 0 && <div className="text-center text-muted-foreground py-16">No services. Click "New Service" to add one.</div>}
      </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">{editId ? "Edit Service" : "New Service"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[10px] uppercase tracking-wider">Name *</Label><Input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider">Category *</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger className="mt-1 bg-background border-border rounded-sm" data-testid="svc-category"><SelectValue placeholder={cats.length ? "Choose category" : "Create a category first"} /></SelectTrigger>
                  <SelectContent className="bg-[#0F1115] border-border max-h-[280px]">
                    {cats.filter(c => c.active !== false).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {cats.length === 0 && <div className="text-[11px] text-[#FFCC00] mt-1">Switch to the Categories tab to create one.</div>}
              </div>
              <div className="col-span-2">
                <Label className="text-[10px] uppercase tracking-wider">Pricing Mode</Label>
                <Select value={form.pricing_mode} onValueChange={(v) => setForm({...form, pricing_mode: v})}>
                  <SelectTrigger className="mt-1 bg-background border-border rounded-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0F1115] border-border">
                    <SelectItem value="fixed">Fixed Price</SelectItem>
                    <SelectItem value="per_vehicle_type">By Vehicle Type</SelectItem>
                    <SelectItem value="full_vehicle">Full Vehicle Package (per type)</SelectItem>
                    <SelectItem value="per_panel">Per Panel (per type)</SelectItem>
                    <SelectItem value="per_glass_area">Per Glass Area (per type)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label className="text-[10px] uppercase tracking-wider">Description</Label><Input value={form.description || ""} onChange={e => setForm({...form, description: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
              <div className="col-span-2 flex items-center gap-2 border border-border rounded-sm p-3 bg-[#FFCC00]/5">
                <Checkbox id="is_bundle" checked={!!form.is_bundle} onCheckedChange={(v) => setForm({...form, is_bundle: !!v})} className="border-[#FFCC00]" />
                <Label htmlFor="is_bundle" className="text-sm cursor-pointer">This is a discounted package/bundle</Label>
              </div>
              {form.is_bundle && (
                <div className="col-span-2 border border-border rounded-sm p-3">
                  <Label className="text-[10px] uppercase tracking-wider">Included Services (for display)</Label>
                  <div className="flex gap-2 mt-2">
                    <Input value={bundleInput} onChange={e => setBundleInput(e.target.value)} placeholder="e.g. Premium Car Wash" className="bg-background border-border rounded-sm" />
                    <Button type="button" onClick={addBundleItem} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm">Add</Button>
                  </div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {(form.bundle_items || []).map((it, i) => (
                      <span key={i} className="text-xs border border-border rounded-sm px-2 py-1 flex items-center gap-1">
                        {it}
                        <button type="button" onClick={() => setForm({...form, bundle_items: form.bundle_items.filter((_, x) => x !== i)})} className="hover:text-[#FF3B30]">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {form.pricing_mode === "fixed" && (
              <div><Label className="text-[10px] uppercase tracking-wider">Fixed Price (KWD)</Label><Input type="number" step="0.001" value={form.fixed_price || 0} onChange={e => setForm({...form, fixed_price: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
            )}
            {(form.pricing_mode === "per_vehicle_type" || form.pricing_mode === "full_vehicle") && (
              <div className="space-y-2 border border-border rounded-sm p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Price by Vehicle Type</div>
                <div className="grid grid-cols-2 gap-2">
                  {vts.map(t => (
                    <div key={t.key}>
                      <Label className="text-[10px] uppercase">{t.label}</Label>
                      <Input type="number" step="0.001"
                        value={(form.pricing_mode === "per_vehicle_type" ? form.vehicle_type_prices[t.key] : form.full_vehicle_prices[t.key]) || 0}
                        onChange={(e) => form.pricing_mode === "per_vehicle_type" ? setVtPrice(t.key, e.target.value) : setFullVehiclePrice(t.key, e.target.value)}
                        className="mt-1 bg-background border-border rounded-sm" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {form.pricing_mode === "per_panel" && (
              <div className="space-y-3">
                {vts.map(t => (
                  <details key={t.key} className="border border-border rounded-sm">
                    <summary className="px-4 py-3 cursor-pointer text-sm font-semibold">{t.label} — Panel Prices</summary>
                    <div className="grid grid-cols-2 gap-2 p-4 pt-0">
                      {t.panels.map(p => (
                        <div key={p.id}><Label className="text-[10px] uppercase">{p.label}</Label><Input type="number" step="0.001" value={form.panel_prices?.[t.key]?.[p.id] || 0} onChange={(e) => setPanelPrice(t.key, p.id, e.target.value)} className="mt-1 bg-background border-border rounded-sm" /></div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
            {form.pricing_mode === "per_glass_area" && (
              <div className="space-y-3">
                {vts.map(t => (
                  <details key={t.key} className="border border-border rounded-sm">
                    <summary className="px-4 py-3 cursor-pointer text-sm font-semibold">{t.label} — Glass Prices</summary>
                    <div className="grid grid-cols-2 gap-2 p-4 pt-0">
                      {t.glass_areas.map(g => (
                        <div key={g.id}><Label className="text-[10px] uppercase">{g.label}</Label><Input type="number" step="0.001" value={form.glass_prices?.[t.key]?.[g.id] || 0} onChange={(e) => setGlassPrice(t.key, g.id, e.target.value)} className="mt-1 bg-background border-border rounded-sm" /></div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm cursor-pointer border border-border rounded-sm p-3">
              <Checkbox checked={form.active !== false} onCheckedChange={(v) => setForm({ ...form, active: !!v })} className="border-border" data-testid="svc-active" />
              Active
            </label>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button type="submit" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="svc-save">Save Service</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-lg w-[calc(100vw-1.5rem)] sm:w-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">{catEditId ? "Edit Service Category" : "New Service Category"}</DialogTitle></DialogHeader>
          <form onSubmit={saveCat} className="space-y-3 mt-2" data-testid="svc-cat-form">
            <div><Label className="text-[10px] uppercase tracking-wider">Name *</Label><Input required value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} className="mt-1 bg-background border-border rounded-sm" data-testid="svc-cat-name" autoFocus /></div>
            <div><Label className="text-[10px] uppercase tracking-wider">Description</Label><Input value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} className="mt-1 bg-background border-border rounded-sm" /></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={catForm.active} onCheckedChange={(v) => setCatForm({ ...catForm, active: !!v })} className="border-border" />
              Active
            </label>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setCatOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button type="submit" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="svc-cat-save">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const TabButton = ({ active, onClick, children, testid }) => (
  <button onClick={onClick} data-testid={testid}
    className={`px-4 py-2.5 text-xs uppercase tracking-widest font-semibold border-b-2 transition ${active ? "border-[#0066FF] text-white" : "border-transparent text-muted-foreground hover:text-white"}`}>
    {children}
  </button>
);
