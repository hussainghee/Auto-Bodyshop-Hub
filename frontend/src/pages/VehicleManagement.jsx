import { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Plus, ChevronLeft, Search, Trash2, Edit3, Car } from "lucide-react";
import { toast } from "sonner";

const emptyBrand = { name: "", active: true };
const emptyModel = { brand_id: "", name: "", vehicle_type: "", active: true };

export default function VehicleManagement() {
  const [brands, setBrands] = useState([]);
  const [vts, setVts] = useState([]);
  const [q, setQ] = useState("");
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [models, setModels] = useState([]);

  const [brandOpen, setBrandOpen] = useState(false);
  const [brandForm, setBrandForm] = useState(emptyBrand);
  const [brandEditId, setBrandEditId] = useState(null);

  const [modelOpen, setModelOpen] = useState(false);
  const [modelForm, setModelForm] = useState(emptyModel);
  const [modelEditId, setModelEditId] = useState(null);

  const loadBrands = async () => setBrands((await api.get("/vehicle-brands", { params: q ? { q } : {} })).data);
  const loadModels = async (bid) => setModels((await api.get("/vehicle-models", { params: { brand_id: bid } })).data);

  useEffect(() => { const t = setTimeout(loadBrands, 200); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);
  useEffect(() => { api.get("/vehicle-types").then(r => setVts(r.data)); }, []);
  useEffect(() => {
    if (selectedBrand) loadModels(selectedBrand.id);
  }, [selectedBrand]);

  const saveBrand = async (e) => {
    e.preventDefault();
    try {
      if (brandEditId) await api.patch(`/vehicle-brands/${brandEditId}`, brandForm);
      else await api.post("/vehicle-brands", brandForm);
      toast.success("Brand saved");
      setBrandOpen(false); setBrandForm(emptyBrand); setBrandEditId(null); loadBrands();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };
  const startBrandEdit = (b) => { setBrandForm({ name: b.name, active: b.active !== false }); setBrandEditId(b.id); setBrandOpen(true); };
  const removeBrand = async (b) => {
    if (!window.confirm(`Delete brand "${b.name}"?`)) return;
    try { await api.delete(`/vehicle-brands/${b.id}`); toast.success("Deleted"); loadBrands(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const saveModel = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...modelForm, brand_id: selectedBrand.id };
      if (modelEditId) await api.patch(`/vehicle-models/${modelEditId}`, payload);
      else await api.post("/vehicle-models", payload);
      toast.success("Model saved");
      setModelOpen(false); setModelForm({ ...emptyModel, brand_id: selectedBrand.id }); setModelEditId(null);
      loadModels(selectedBrand.id);
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };
  const startModelEdit = (m) => { setModelForm({ brand_id: m.brand_id, name: m.name, vehicle_type: m.vehicle_type || "", active: m.active !== false }); setModelEditId(m.id); setModelOpen(true); };
  const removeModel = async (m) => {
    if (!window.confirm(`Delete model "${m.name}"?`)) return;
    try { await api.delete(`/vehicle-models/${m.id}`); toast.success("Deleted"); loadModels(selectedBrand.id); }
    catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  // BRAND VIEW
  if (!selectedBrand) {
    return (
      <div data-testid="vehicle-mgmt-page">
        <PageHeader title="Vehicle Management" subtitle="Settings"
          actions={<Button onClick={() => { setBrandForm(emptyBrand); setBrandEditId(null); setBrandOpen(true); }} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="new-brand-btn"><Plus size={16} className="mr-1.5" /> New Brand</Button>}
        />
        <div className="p-4 sm:p-8 space-y-4">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search brands…" value={q} onChange={e => setQ(e.target.value)} className="pl-9 bg-[#0F1115] border-border rounded-sm h-10" data-testid="brand-search" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {brands.map(b => (
              <div key={b.id} className="border border-border bg-[#0F1115] rounded-sm p-4 flex items-center justify-between gap-2 hover:border-[#0066FF]/40 cursor-pointer transition" onClick={() => setSelectedBrand(b)} data-testid={`brand-card-${b.id}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Car size={14} className="text-[#3385FF]" />
                    <div className="font-display text-lg font-bold truncate">{b.name}</div>
                    {b.active === false && <span className="tag-status border border-border text-muted-foreground">INACTIVE</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">{b.model_count || 0} models</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); startBrandEdit(b); }} className="p-2 text-muted-foreground hover:text-white" data-testid={`edit-brand-${b.id}`}><Edit3 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); removeBrand(b); }} className="p-2 text-muted-foreground hover:text-[#FF3B30]" data-testid={`del-brand-${b.id}`}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {brands.length === 0 && <div className="col-span-full text-center text-muted-foreground py-12">No brands. Create one to get started.</div>}
          </div>
        </div>

        <Dialog open={brandOpen} onOpenChange={setBrandOpen}>
          <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-md w-[calc(100vw-1.5rem)] sm:w-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-black tracking-tighter">{brandEditId ? "Edit Brand" : "New Brand"}</DialogTitle>
              <DialogDescription className="sr-only">Vehicle brand name and active status.</DialogDescription>
            </DialogHeader>
            <form onSubmit={saveBrand} className="space-y-3 mt-2" data-testid="brand-form">
              <div><Label className="text-[10px] uppercase tracking-wider">Brand Name *</Label><Input required value={brandForm.name} onChange={e => setBrandForm({ ...brandForm, name: e.target.value })} className="mt-1 bg-background border-border rounded-sm" data-testid="brand-name" autoFocus /></div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={brandForm.active} onCheckedChange={(v) => setBrandForm({ ...brandForm, active: !!v })} className="border-border" />
                Active
              </label>
              <DialogFooter className="pt-3">
                <Button type="button" variant="outline" onClick={() => setBrandOpen(false)} className="border-border rounded-sm">Cancel</Button>
                <Button type="submit" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="brand-save">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // MODELS VIEW
  return (
    <div data-testid="vehicle-mgmt-models">
      <PageHeader title={selectedBrand.name} subtitle="Models"
        actions={<>
          <Button variant="outline" onClick={() => setSelectedBrand(null)} className="border-border rounded-sm" data-testid="back-to-brands"><ChevronLeft size={14} className="mr-1" /> Brands</Button>
          <Button onClick={() => { setModelForm({ ...emptyModel, brand_id: selectedBrand.id }); setModelEditId(null); setModelOpen(true); }} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="new-model-btn"><Plus size={16} className="mr-1.5" /> New Model</Button>
        </>}
      />
      <div className="p-4 sm:p-8">
        <div className="border border-border bg-[#0F1115] rounded-sm overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border">
                <th className="text-left px-4 sm:px-6 py-3">Model</th>
                <th className="text-left px-4 sm:px-6 py-3">Vehicle Type</th>
                <th className="text-left px-4 sm:px-6 py-3">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {models.map(m => (
                <tr key={m.id} className="border-b border-border/60 hover:bg-white/[0.02]" data-testid={`model-row-${m.id}`}>
                  <td className="px-4 sm:px-6 py-3 font-semibold">{m.name}</td>
                  <td className="px-4 sm:px-6 py-3 text-muted-foreground capitalize">{m.vehicle_type || "—"}</td>
                  <td className="px-4 sm:px-6 py-3">
                    <span className={`text-[10px] uppercase tracking-widest border rounded-sm px-2 py-0.5 ${m.active !== false ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5" : "border-border text-muted-foreground"}`}>{m.active !== false ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-right">
                    <button onClick={() => startModelEdit(m)} className="text-[#3385FF] text-xs hover:underline mr-3" data-testid={`edit-model-${m.id}`}><Edit3 size={12} className="inline mr-1" />Edit</button>
                    <button onClick={() => removeModel(m)} className="text-[#FF3B30] text-xs hover:underline" data-testid={`del-model-${m.id}`}><Trash2 size={12} className="inline mr-1" />Delete</button>
                  </td>
                </tr>
              ))}
              {models.length === 0 && <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No models yet for {selectedBrand.name}.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={modelOpen} onOpenChange={setModelOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-md w-[calc(100vw-1.5rem)] sm:w-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-black tracking-tighter">{modelEditId ? "Edit Model" : "New Model"}</DialogTitle>
            <DialogDescription className="sr-only">Vehicle model details for the selected brand.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveModel} className="space-y-3 mt-2" data-testid="model-form">
            <div><Label className="text-[10px] uppercase tracking-wider">Model Name *</Label><Input required value={modelForm.name} onChange={e => setModelForm({ ...modelForm, name: e.target.value })} className="mt-1 bg-background border-border rounded-sm" data-testid="model-name" autoFocus /></div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider">Vehicle Type</Label>
              <Select value={modelForm.vehicle_type} onValueChange={(v) => setModelForm({ ...modelForm, vehicle_type: v })}>
                <SelectTrigger className="mt-1 bg-background border-border rounded-sm" data-testid="model-vehicle-type"><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent className="bg-[#0F1115] border-border">
                  <SelectItem value="none">None</SelectItem>
                  {vts.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={modelForm.active} onCheckedChange={(v) => setModelForm({ ...modelForm, active: !!v })} className="border-border" />
              Active
            </label>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setModelOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button type="submit" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="model-save">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
