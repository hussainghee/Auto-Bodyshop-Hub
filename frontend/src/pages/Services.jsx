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
  name: "", category: "paint_protection", pricing_mode: "fixed", description: "",
  fixed_price: 0, vehicle_type_prices: {}, panel_prices: {}, glass_prices: {}, full_vehicle_prices: {},
  is_bundle: false, bundle_items: [], active: true,
};

export default function Services() {
  const [list, setList] = useState([]);
  const [vts, setVts] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [bundleInput, setBundleInput] = useState("");

  const load = async () => {
    const [s, t] = await Promise.all([api.get("/services"), api.get("/vehicle-types")]);
    setList(s.data); setVts(t.data);
  };
  useEffect(() => { load(); }, []);

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
      const payload = { ...form, fixed_price: form.pricing_mode === "fixed" ? Number(form.fixed_price) : null };
      if (editId) await api.patch(`/services/${editId}`, payload);
      else await api.post("/services", payload);
      toast.success("Saved");
      setOpen(false); setForm(emptyForm); setEditId(null); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const startEdit = (s) => { setForm({ ...emptyForm, ...s }); setEditId(s.id); setOpen(true); };

  const addBundleItem = () => {
    if (!bundleInput.trim()) return;
    setForm({ ...form, bundle_items: [...(form.bundle_items || []), bundleInput.trim()] });
    setBundleInput("");
  };

  return (
    <div data-testid="services-page">
      <PageHeader title="Services & Pricing" subtitle="Catalog"
        actions={<Button onClick={() => { setForm(emptyForm); setEditId(null); setOpen(true); }} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm"><Plus size={16} className="mr-1.5" /> New Service</Button>}
      />
      <div className="p-8 space-y-3">
        {list.map(s => (
          <div key={s.id} className="border border-border bg-[#0F1115] rounded-sm p-5 flex items-start justify-between" data-testid={`service-row-${s.id}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-display text-xl font-bold">{s.name}</div>
                {s.is_bundle && <span className="tag-status" style={{ color: "#FFCC00", background: "rgba(255,204,0,0.08)", borderColor: "#FFCC00" }}><Package size={10} className="inline mr-1" />BUNDLE</span>}
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border px-2 py-0.5 rounded-sm">{s.category.replace(/_/g, " ")}</span>
                <span className="text-[10px] uppercase tracking-widest text-[#3385FF] border border-[#0066FF]/40 bg-[#0066FF]/10 px-2 py-0.5 rounded-sm">{s.pricing_mode.replace(/_/g, " ")}</span>
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
            <Button onClick={() => startEdit(s)} variant="outline" className="border-border rounded-sm">Edit</Button>
          </div>
        ))}
        {list.length === 0 && <div className="text-center text-muted-foreground py-16">No services.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">{editId ? "Edit Service" : "New Service"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[10px] uppercase tracking-wider">Name *</Label><Input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                  <SelectTrigger className="mt-1 bg-background border-border rounded-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0F1115] border-border">
                    <SelectItem value="paint_protection">Paint Protection</SelectItem>
                    <SelectItem value="tint">Tint</SelectItem>
                    <SelectItem value="full_body_paint">Full Body Paint</SelectItem>
                    <SelectItem value="car_wash">Car Wash</SelectItem>
                    <SelectItem value="mobile_car_wash">Mobile Car Wash</SelectItem>
                    <SelectItem value="bundle">Bundle / Package</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
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

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button type="submit" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm">Save Service</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
