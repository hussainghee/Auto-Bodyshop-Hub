import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, fmtKWD, fmtDate, waLink } from "../lib/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import MakeModelSelect from "../components/MakeModelSelect";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function CustomerDetail() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [vts, setVts] = useState([]);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ vehicle_type: "sedan", make: "", model: "", year: "", plate: "", vin: "", color: "" });

  const load = async () => {
    const [cust, types] = await Promise.all([api.get(`/customers/${id}`), api.get("/vehicle-types")]);
    setC(cust.data); setVts(types.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const addVehicle = async (e) => {
    e.preventDefault();
    try {
      await api.post("/vehicles", { ...v, customer_id: id, year: v.year ? parseInt(v.year) : null });
      toast.success("Vehicle added");
      setOpen(false);
      setV({ vehicle_type: "sedan", make: "", model: "", year: "", plate: "", vin: "", color: "" });
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  if (!c) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div data-testid="customer-detail-page">
      <PageHeader title={c.name} subtitle="Customer"
        actions={<>
          <a href={waLink(c.mobile)} target="_blank" rel="noreferrer"><Button variant="outline" className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 rounded-sm"><MessageCircle size={14} className="mr-1.5" /> WhatsApp</Button></a>
          <Link to="/customers"><Button variant="outline" className="border-border rounded-sm">← Back</Button></Link>
          <Button onClick={() => setOpen(true)} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="add-vehicle-btn"><Plus size={16} className="mr-1.5" /> Vehicle</Button>
        </>}
      />
      <div className="p-8 space-y-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="border border-border bg-[#0F1115] rounded-sm p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Contact</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><Phone size={14} className="text-muted-foreground" /> <span className="font-mono-data">{c.mobile}</span></div>
              <div className="flex items-center gap-2"><Mail size={14} className="text-muted-foreground" /> <span>{c.email || "—"}</span></div>
              <div className="flex items-start gap-2"><MapPin size={14} className="text-muted-foreground mt-0.5" /> <span>{c.address || "—"}</span></div>
            </div>
          </div>
          <div className="border border-border bg-[#0F1115] rounded-sm p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Preferred Contact</div>
            <div className="font-display text-2xl font-bold capitalize">{c.preferred_contact}</div>
          </div>
          <div className="border border-border bg-[#0F1115] rounded-sm p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Notes</div>
            <div className="text-sm text-muted-foreground">{c.notes || "—"}</div>
          </div>
        </div>

        <Section title="Vehicles" count={c.vehicles?.length || 0}>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border"><th className="text-left px-6 py-3">Make / Model</th><th className="text-left px-6 py-3">Type</th><th className="text-left px-6 py-3">Year</th><th className="text-left px-6 py-3">Plate</th><th className="text-left px-6 py-3">Color</th><th /></tr>
            </thead>
            <tbody>
              {(c.vehicles || []).map(veh => (
                <tr key={veh.id} className="border-b border-border/60 hover:bg-white/[0.02]">
                  <td className="px-6 py-3 font-semibold">{veh.make} {veh.model}</td>
                  <td className="px-6 py-3 capitalize">{veh.vehicle_type}</td>
                  <td className="px-6 py-3">{veh.year || "—"}</td>
                  <td className="px-6 py-3 font-mono-data">{veh.plate || "—"}</td>
                  <td className="px-6 py-3">{veh.color || "—"}</td>
                  <td className="px-6 py-3 text-right"><Link to={`/vehicles/${veh.id}`} className="text-[#3385FF] text-xs hover:underline">Open →</Link></td>
                </tr>
              ))}
              {(!c.vehicles || c.vehicles.length === 0) && <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No vehicles yet.</td></tr>}
            </tbody>
          </table>
        </Section>

        <Section title="Quotations" count={c.quotations?.length || 0}>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border"><th className="text-left px-6 py-3">Number</th><th className="text-left px-6 py-3">Status</th><th className="text-left px-6 py-3">Date</th><th className="text-right px-6 py-3">Total</th></tr>
            </thead>
            <tbody>
              {(c.quotations || []).map(q => (
                <tr key={q.id} className="border-b border-border/60"><td className="px-6 py-3 font-mono-data font-semibold"><Link to={`/quotations/${q.id}`} className="hover:text-[#3385FF]">{q.number}</Link></td><td className="px-6 py-3"><StatusBadge status={q.status} /></td><td className="px-6 py-3 text-muted-foreground">{fmtDate(q.created_at)}</td><td className="px-6 py-3 text-right font-mono-data">{fmtKWD(q.total)}</td></tr>
              ))}
              {(!c.quotations || c.quotations.length === 0) && <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No quotations yet.</td></tr>}
            </tbody>
          </table>
        </Section>

        <Section title="Job Cards" count={c.jobs?.length || 0}>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border"><th className="text-left px-6 py-3">Number</th><th className="text-left px-6 py-3">Status</th><th className="text-left px-6 py-3">Date</th><th className="text-right px-6 py-3">Total</th></tr>
            </thead>
            <tbody>
              {(c.jobs || []).map(j => (
                <tr key={j.id} className="border-b border-border/60"><td className="px-6 py-3 font-mono-data font-semibold"><Link to={`/jobs/${j.id}`} className="hover:text-[#3385FF]">{j.number}</Link></td><td className="px-6 py-3"><StatusBadge status={j.status} /></td><td className="px-6 py-3 text-muted-foreground">{fmtDate(j.created_at)}</td><td className="px-6 py-3 text-right font-mono-data">{fmtKWD(j.total)}</td></tr>
              ))}
              {(!c.jobs || c.jobs.length === 0) && <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No jobs yet.</td></tr>}
            </tbody>
          </table>
        </Section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-xl">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">Add Vehicle</DialogTitle></DialogHeader>
          <form onSubmit={addVehicle} className="space-y-3 mt-2" data-testid="vehicle-form">
            <div>
              <Label className="text-[10px] uppercase tracking-wider">Vehicle Type *</Label>
              <Select value={v.vehicle_type} onValueChange={(val) => setV({...v, vehicle_type: val})}>
                <SelectTrigger className="mt-1 bg-background border-border rounded-sm" data-testid="vehicle-type-select"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0F1115] border-border">
                  {vts.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MakeModelSelect make={v.make} model={v.model} required onChange={({ make, model }) => setV({ ...v, make, model })} />
              <div><Label className="text-[10px] uppercase tracking-wider">Year</Label><Input type="number" className="mt-1 bg-background border-border rounded-sm" value={v.year} onChange={e => setV({...v, year: e.target.value})} /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Plate</Label><Input className="mt-1 bg-background border-border rounded-sm" value={v.plate} onChange={e => setV({...v, plate: e.target.value})} /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">VIN / Chassis</Label><Input className="mt-1 bg-background border-border rounded-sm" value={v.vin} onChange={e => setV({...v, vin: e.target.value})} /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Color</Label><Input className="mt-1 bg-background border-border rounded-sm" value={v.color} onChange={e => setV({...v, color: e.target.value})} /></div>
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button type="submit" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="vehicle-save">Add Vehicle</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Section = ({ title, count, children }) => (
  <div className="border border-border bg-[#0F1115] rounded-sm overflow-x-auto">
    <div className="px-6 py-4 border-b border-border flex items-center justify-between">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{title}</div>
      <div className="text-xs text-muted-foreground">{count}</div>
    </div>
    {children}
  </div>
);
