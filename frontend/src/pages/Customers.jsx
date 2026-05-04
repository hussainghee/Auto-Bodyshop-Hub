import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDate, waLink, API } from "../lib/api";
import PageHeader from "../components/PageHeader";
import MakeModelSelect from "../components/MakeModelSelect";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Search, Plus, Trash2, MessageCircle, Download, Upload } from "lucide-react";
import { toast } from "sonner";

const emptyVeh = { vehicle_type: "sedan", make: "", model: "", year: "", plate: "", vin: "", color: "" };
const emptyForm = {
  name: "", mobile: "", email: "", address: "", city: "", notes: "",
  preferred_contact: "mobile", vehicles: [],
};

export default function Customers() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [vts, setVts] = useState([]);
  const fileRef = useRef(null);

  const [importSummary, setImportSummary] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    const { data } = await api.get("/customers", { params: q ? { q } : {} });
    setList(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);
  useEffect(() => { api.get("/vehicle-types").then(r => setVts(r.data)); }, []);

  const addVehicleRow = () => setForm({ ...form, vehicles: [...form.vehicles, { ...emptyVeh }] });
  const updateVehicle = (i, patch) => {
    setForm({ ...form, vehicles: form.vehicles.map((v, idx) => idx === i ? { ...v, ...patch } : v) });
  };
  const removeVehicle = (i) => setForm({ ...form, vehicles: form.vehicles.filter((_, idx) => idx !== i) });

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.mobile.trim()) { toast.error("Name and mobile are required"); return; }
    try {
      const vehicles = form.vehicles
        .filter(v => v.make && v.model)
        .map(v => ({
          vehicle_type: v.vehicle_type,
          make: v.make === "__other__" ? "Other" : v.make,
          model: v.model === "__other_model__" ? "" : v.model,
          year: v.year ? parseInt(v.year) : null,
          plate: v.plate || null, vin: v.vin || null, color: v.color || null,
        }));
      await api.post("/customers", {
        name: form.name.trim(), mobile: form.mobile.trim(),
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        notes: form.notes.trim() || null,
        preferred_contact: form.preferred_contact,
        vehicles,
      });
      toast.success(`Customer saved${vehicles.length > 0 ? ` with ${vehicles.length} vehicle(s)` : ""}`);
      setOpen(false); setForm(emptyForm); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed to save"); }
  };

  const exportCustomers = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API}/export/customers${q ? "?q=" + encodeURIComponent(q) : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `customers_${new Date().toISOString().slice(0,10)}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported");
    } catch { toast.error("Export failed"); }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    try {
      const { data } = await api.post("/import/customers", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setImportSummary(data);
      setImportOpen(true);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Import failed"); }
    e.target.value = "";
  };

  return (
    <div data-testid="customers-page">
      <PageHeader title="Customers" subtitle="CRM"
        actions={<>
          <Button variant="outline" onClick={exportCustomers} className="border-border rounded-sm" data-testid="export-customers-btn"><Download size={14} className="mr-1.5" /> Export</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="border-border rounded-sm" data-testid="import-customers-btn"><Upload size={14} className="mr-1.5" /> Import</Button>
          <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onImport} data-testid="import-customers-file" />
          <Button onClick={() => { setForm(emptyForm); setOpen(true); }} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="new-customer-btn"><Plus size={16} className="mr-1.5" /> New Customer</Button>
        </>}
      />
      <div className="p-8 space-y-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or mobile…" value={q} onChange={e => setQ(e.target.value)} className="pl-9 bg-[#0F1115] border-border rounded-sm h-10" data-testid="customer-search" />
        </div>

        <div className="border border-border bg-[#0F1115] rounded-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3">Name</th>
                <th className="text-left px-6 py-3">Mobile</th>
                <th className="text-left px-6 py-3">Email</th>
                <th className="text-left px-6 py-3">City</th>
                <th className="text-left px-6 py-3">Contact</th>
                <th className="text-left px-6 py-3">Created</th>
                <th />
              </tr>
            </thead>
            <tbody data-testid="customer-table">
              {list.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No customers found.</td></tr>}
              {list.map(c => (
                <tr key={c.id} className="border-b border-border/60 hover:bg-white/[0.02]" data-testid={`customer-row-${c.id}`}>
                  <td className="px-6 py-3 font-semibold">{c.name}</td>
                  <td className="px-6 py-3 font-mono-data">
                    <div className="flex items-center gap-2">
                      {c.mobile}
                      <a href={waLink(c.mobile)} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300" data-testid={`wa-${c.id}`}><MessageCircle size={14} /></a>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{c.email || "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground">{c.city || "—"}</td>
                  <td className="px-6 py-3"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.preferred_contact}</span></td>
                  <td className="px-6 py-3 text-muted-foreground">{c.created_at ? fmtDate(c.created_at) : "—"}</td>
                  <td className="px-6 py-3 text-right"><Link to={`/customers/${c.id}`} className="text-[#3385FF] text-xs hover:underline">Open →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW CUSTOMER MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">New Customer</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4 mt-2" data-testid="customer-form">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[10px] uppercase tracking-wider">Name *</Label><Input required className="mt-1 bg-background border-border rounded-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} data-testid="customer-name" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Mobile *</Label><Input required className="mt-1 bg-background border-border rounded-sm" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} data-testid="customer-mobile" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Email</Label><Input type="email" className="mt-1 bg-background border-border rounded-sm" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">City / Area</Label><Input className="mt-1 bg-background border-border rounded-sm" value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="e.g. Salmiya" data-testid="customer-city" /></div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider">Preferred Contact</Label>
                <Select value={form.preferred_contact} onValueChange={(v) => setForm({...form, preferred_contact: v})}>
                  <SelectTrigger className="mt-1 bg-background border-border rounded-sm" data-testid="customer-contact-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0F1115] border-border">
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-[10px] uppercase tracking-wider">Address</Label><Input className="mt-1 bg-background border-border rounded-sm" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
            <div><Label className="text-[10px] uppercase tracking-wider">Notes</Label><Input className="mt-1 bg-background border-border rounded-sm" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>

            <div className="border border-border rounded-sm">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Vehicles (optional)</div>
                <Button type="button" size="sm" onClick={addVehicleRow} className="bg-[#0066FF]/10 hover:bg-[#0066FF] text-[#3385FF] hover:text-white border border-[#0066FF]/40 rounded-sm" data-testid="add-vehicle-row-btn"><Plus size={14} className="mr-1" /> Add Vehicle</Button>
              </div>
              <div className="divide-y divide-border">
                {form.vehicles.length === 0 && <div className="px-4 py-6 text-center text-sm text-muted-foreground">No vehicles yet.</div>}
                {form.vehicles.map((v, i) => (
                  <div key={i} className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 relative" data-testid={`inline-vehicle-${i}`}>
                    <button type="button" onClick={() => removeVehicle(i)} className="absolute top-2 right-2 text-muted-foreground hover:text-[#FF3B30]"><Trash2 size={14} /></button>
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider">Type</Label>
                      <Select value={v.vehicle_type} onValueChange={(val) => updateVehicle(i, { vehicle_type: val })}>
                        <SelectTrigger className="mt-1 bg-background border-border rounded-sm"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#0F1115] border-border">
                          {vts.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <MakeModelSelect make={v.make} model={v.model} onChange={({ make, model }) => updateVehicle(i, { make, model })} />
                    <div><Label className="text-[10px] uppercase tracking-wider">Year</Label><Input type="number" className="mt-1 bg-background border-border rounded-sm" value={v.year} onChange={e => updateVehicle(i, { year: e.target.value })} /></div>
                    <div><Label className="text-[10px] uppercase tracking-wider">Plate</Label><Input className="mt-1 bg-background border-border rounded-sm" value={v.plate} onChange={e => updateVehicle(i, { plate: e.target.value })} /></div>
                    <div><Label className="text-[10px] uppercase tracking-wider">VIN</Label><Input className="mt-1 bg-background border-border rounded-sm" value={v.vin} onChange={e => updateVehicle(i, { vin: e.target.value })} /></div>
                    <div><Label className="text-[10px] uppercase tracking-wider">Color</Label><Input className="mt-1 bg-background border-border rounded-sm" value={v.color} onChange={e => updateVehicle(i, { color: e.target.value })} /></div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button type="submit" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="customer-save">Save Customer{form.vehicles.length > 0 ? ` + ${form.vehicles.length} Vehicle(s)` : ""}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* IMPORT SUMMARY MODAL */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">Import Summary</DialogTitle></DialogHeader>
          {importSummary && (
            <div className="space-y-3 mt-2" data-testid="import-summary">
              <div className="grid grid-cols-3 gap-3">
                <SumCard label="Created" value={importSummary.created} accent="#00FF66" />
                <SumCard label="Skipped" value={importSummary.skipped_duplicates} accent="#FFCC00" />
                <SumCard label="Errors" value={importSummary.errors?.length || 0} accent="#FF3B30" />
              </div>
              {importSummary.errors?.length > 0 && (
                <div className="border border-[#FF3B30]/30 rounded-sm p-3 bg-[#FF3B30]/5 max-h-48 overflow-y-auto">
                  <div className="text-[10px] uppercase tracking-widest text-[#FF3B30] mb-1">Errors</div>
                  <ul className="text-xs space-y-1">
                    {importSummary.errors.map((e, i) => <li key={i} className="font-mono-data">{e}</li>)}
                  </ul>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Required columns: <code>name</code>, <code>mobile</code>. Optional: <code>email</code>, <code>address</code>, <code>city</code>, <code>notes</code>, <code>preferred contact</code>.
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => setImportOpen(false)} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm">OK</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const SumCard = ({ label, value, accent }) => (
  <div className="border border-border rounded-sm p-3 text-center">
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    <div className="font-display text-3xl font-black mt-1 font-mono-data" style={{ color: accent }}>{value}</div>
  </div>
);
