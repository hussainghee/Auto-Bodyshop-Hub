import { useEffect, useState } from "react";
import { api, fmtDate } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const empty = { customer_id: "", vehicle_id: "", service_label: "", start: "", end: "", notes: "" };

export default function CalendarPage() {
  const [appts, setAppts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [cursor, setCursor] = useState(new Date());

  const load = async () => {
    const [a, c] = await Promise.all([api.get("/appointments"), api.get("/customers")]);
    setAppts(a.data); setCustomers(c.data);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (form.customer_id) api.get("/vehicles", { params: { customer_id: form.customer_id } }).then(r => setVehicles(r.data));
    else setVehicles([]);
  }, [form.customer_id]);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/appointments", { ...form, vehicle_id: form.vehicle_id || null, end: form.end || null });
      toast.success("Appointment added");
      setOpen(false); setForm(empty); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  // build month grid
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: startDay }, () => null).concat(Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)));

  const apptByDay = (d) => appts.filter(a => {
    const dt = new Date(a.start);
    return d && dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth() && dt.getDate() === d.getDate();
  });

  const monthLabel = cursor.toLocaleString("en-GB", { month: "long", year: "numeric" });

  return (
    <div data-testid="calendar-page">
      <PageHeader title="Appointments" subtitle="Calendar"
        actions={<Button onClick={() => setOpen(true)} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="new-appt-btn"><Plus size={16} className="mr-1.5" /> Schedule</Button>}
      />
      <div className="p-8">
        <div className="border border-border bg-[#0F1115] rounded-sm">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="font-display text-2xl font-bold tracking-tight">{monthLabel}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date(year, month - 1, 1))} className="border-border rounded-sm"><ChevronLeft size={14} /></Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date())} className="border-border rounded-sm">Today</Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date(year, month + 1, 1))} className="border-border rounded-sm"><ChevronRight size={14} /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} className="px-3 py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => (
              <div key={i} className="border-r border-b border-border min-h-[110px] p-2">
                {d && <>
                  <div className="text-xs text-muted-foreground font-mono-data">{d.getDate()}</div>
                  <div className="space-y-1 mt-1">
                    {apptByDay(d).map(a => (
                      <div key={a.id} className="text-[11px] bg-[#0066FF]/15 border-l-2 border-[#0066FF] px-2 py-1 rounded-sm truncate" title={a.service_label}>
                        <div className="font-mono-data text-[10px] text-muted-foreground">{new Date(a.start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
                        <div className="font-semibold truncate">{a.service_label}</div>
                      </div>
                    ))}
                  </div>
                </>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">Schedule Appointment</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3 mt-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider">Customer *</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm({...form, customer_id: v, vehicle_id: ""})}>
                <SelectTrigger className="mt-1 bg-background border-border rounded-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="bg-[#0F1115] border-border">
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider">Vehicle</Label>
              <Select value={form.vehicle_id} onValueChange={(v) => setForm({...form, vehicle_id: v})} disabled={!form.customer_id}>
                <SelectTrigger className="mt-1 bg-background border-border rounded-sm"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent className="bg-[#0F1115] border-border">
                  {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.make} {v.model}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-[10px] uppercase tracking-wider">Service *</Label><Input required value={form.service_label} onChange={e => setForm({...form, service_label: e.target.value})} className="mt-1 bg-background border-border rounded-sm" placeholder="Eg. Full Body PPF" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[10px] uppercase tracking-wider">Start *</Label><Input required type="datetime-local" value={form.start} onChange={e => setForm({...form, start: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">End</Label><Input type="datetime-local" value={form.end} onChange={e => setForm({...form, end: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
            </div>
            <div><Label className="text-[10px] uppercase tracking-wider">Notes</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button type="submit" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
