import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, fileUrl, fmtKWD, fmtDateTime, fmtSeconds, waLink } from "../lib/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, Upload, Trash2, Play, Square, Printer, CreditCard, Edit3, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

const NEXT_STATUS = { confirmed: "in_progress", in_progress: "completed" };
const DEFAULT_CHECKLIST = [
  "Vehicle inspected on arrival",
  "Surface cleaned & prepped",
  "Materials verified",
  "Service completed per spec",
  "Quality inspection passed",
  "Customer walkthrough",
];

export default function JobDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [techs, setTechs] = useState([]);
  const [newItem, setNewItem] = useState("");
  const beforeRef = useRef(null);
  const afterRef = useRef(null);

  const [payOpen, setPayOpen] = useState(false);
  const [payment, setPayment] = useState({ method: "cash", amount: "", auth_code: "", notes: "" });

  const [invoiceEditOpen, setInvoiceEditOpen] = useState(false);
  const [invDiscount, setInvDiscount] = useState(0);
  const [invTax, setInvTax] = useState(0);
  const [invNotes, setInvNotes] = useState("");

  const [liveTick, setLiveTick] = useState(0);

  const load = async () => {
    const { data } = await api.get(`/jobs/${id}`);
    setJob(data);
    setInvDiscount(data.discount || 0);
    setInvTax(data.tax_rate || 0);
    setInvNotes(data.notes || "");
    if (user?.role === "admin" || user?.role === "sales") {
      try {
        const { data: u } = await api.get("/users/technicians");
        setTechs(u);
      } catch {/* tech can't list */}
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // tick every second when timer running
  useEffect(() => {
    if (!job?.timer_running) return;
    const t = setInterval(() => setLiveTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [job?.timer_running]);

  const liveSeconds = (() => {
    if (!job?.timer_running) return job?.total_seconds || 0;
    const running = (job.time_entries || []).find(e => !e.end);
    if (!running) return job.total_seconds || 0;
    const started = new Date(running.start).getTime();
    const running_s = Math.max(0, Math.floor((Date.now() - started) / 1000));
    return (job.total_seconds || 0) + running_s;
  })();
  void liveTick;

  const setStatus = async (status) => {
    await api.post(`/jobs/${id}/status`, { status });
    toast.success("Status updated");
    load();
  };

  const advance = () => {
    const next = NEXT_STATUS[job.status];
    if (!next) return;
    if (next === "completed" && (job.balance_due || 0) > 0.001) {
      if (!window.confirm(`Balance of ${fmtKWD(job.balance_due)} is still due. Mark completed anyway?`)) return;
    }
    setStatus(next);
  };

  const assign = async (technician_id) => {
    await api.post(`/jobs/${id}/assign`, { technician_id });
    toast.success("Assigned");
    load();
  };

  const updateChecklist = async (items) => { await api.post(`/jobs/${id}/checklist`, { items }); load(); };
  const seedChecklist = () => updateChecklist(DEFAULT_CHECKLIST.map(label => ({ label, done: false })));
  const toggleItem = (idx) => updateChecklist(job.checklist.map((it, i) => i === idx ? { ...it, done: !it.done } : it));
  const addItem = () => { if (!newItem.trim()) return; updateChecklist([...(job.checklist || []), { label: newItem.trim(), done: false }]); setNewItem(""); };
  const removeItem = (idx) => updateChecklist(job.checklist.filter((_, i) => i !== idx));

  const upload = async (kind, file) => {
    const fd = new FormData(); fd.append("file", file);
    await api.post(`/jobs/${id}/photos?kind=${kind}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    toast.success("Uploaded"); load();
  };

  const timerStart = async () => { await api.post(`/jobs/${id}/timer/start`); load(); };
  const timerStop  = async () => { await api.post(`/jobs/${id}/timer/stop`); load(); };

  const savePayment = async (e) => {
    e.preventDefault();
    const amt = Number(payment.amount);
    if (!amt || amt <= 0) { toast.error("Enter amount"); return; }
    if ((payment.method === "knet" || payment.method === "credit_card") && !payment.auth_code.trim()) {
      toast.error("Auth code required for K-net / Credit Card"); return;
    }
    try {
      await api.post(`/jobs/${id}/payments`, {
        method: payment.method, amount: amt,
        auth_code: payment.auth_code.trim() || null,
        notes: payment.notes.trim() || null,
      });
      toast.success("Payment recorded");
      setPayOpen(false);
      setPayment({ method: "cash", amount: "", auth_code: "", notes: "" });
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const deletePayment = async (pid) => {
    if (!window.confirm("Delete this payment?")) return;
    await api.delete(`/jobs/${id}/payments/${pid}`);
    load();
  };

  const saveInvoiceEdit = async () => {
    try {
      await api.patch(`/jobs/${id}/invoice`, {
        discount: Number(invDiscount), tax_rate: Number(invTax), notes: invNotes,
      });
      toast.success("Invoice updated");
      setInvoiceEditOpen(false);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  if (!job) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const canEdit = user?.role !== "technician" || job.technician_id === user.id;
  const canRecordPayment = user?.role === "admin" || user?.role === "sales";
  const waMsg = `Hi ${job.customer?.name}, your ${job.invoice_number ? "invoice " + job.invoice_number : "job " + job.number} is ${job.status.replace("_", " ")}. Total ${fmtKWD(job.total)}${job.balance_due > 0 ? `. Balance due ${fmtKWD(job.balance_due)}` : ""}.`;

  return (
    <div data-testid="job-detail-page">
      <PageHeader title={job.invoice_number || job.number} subtitle={job.invoice_number ? "Invoice" : "Job Card"}
        actions={<>
          <Link to="/jobs" className="no-print"><Button variant="outline" className="border-border rounded-sm">← Back</Button></Link>
          <Button onClick={() => window.print()} variant="outline" className="border-border rounded-sm no-print"><Printer size={14} className="mr-1.5" /> Print</Button>
          {job.customer?.mobile && <a href={waLink(job.customer.mobile, waMsg)} target="_blank" rel="noreferrer" className="no-print"><Button variant="outline" className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 rounded-sm"><MessageCircle size={14} className="mr-1.5" /> WhatsApp</Button></a>}
          {canEdit && NEXT_STATUS[job.status] && <Button onClick={advance} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm no-print" data-testid="advance-status-btn">Mark {NEXT_STATUS[job.status].replace("_", " ")} →</Button>}
          {canEdit && job.status !== "completed" && job.status !== "cancelled" && <Button onClick={() => setStatus("cancelled")} variant="outline" className="border-[#FF3B30] text-[#FF3B30] rounded-sm no-print">Cancel Job</Button>}
        </>}
      />

      <div className="p-8 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* INVOICE CARD */}
          <div className="border border-border bg-[#0F1115] rounded-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Customer · Vehicle</div>
                <div className="font-display text-2xl font-bold mt-1">{job.customer?.name}</div>
                <div className="text-sm text-muted-foreground mt-1">{job.vehicle?.make} {job.vehicle?.model} · {job.vehicle?.plate || "no plate"}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={job.status} />
                <PaymentStatusBadge status={job.payment_status} />
              </div>
            </div>
            <table className="w-full text-sm border-t border-border mt-4">
              <thead className="text-[10px] uppercase tracking-widest text-muted-foreground"><tr className="border-b border-border"><th className="text-left py-3">Service</th><th className="text-right py-3">Qty</th><th className="text-right py-3">Unit</th><th className="text-right py-3">Total</th></tr></thead>
              <tbody>
                {job.lines.map((l, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-2">{l.service_name}{l.selected_areas?.length > 0 && <span className="text-[11px] text-muted-foreground ml-2">({l.selected_areas.length} areas)</span>}</td>
                    <td className="py-2 text-right font-mono-data">{l.quantity}</td>
                    <td className="py-2 text-right font-mono-data">{fmtKWD(l.unit_price)}</td>
                    <td className="py-2 text-right font-mono-data">{fmtKWD(l.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="grid grid-cols-2 mt-4 gap-6">
              <div>
                {canRecordPayment && (
                  <Button size="sm" variant="outline" onClick={() => setInvoiceEditOpen(true)} className="border-border rounded-sm no-print" data-testid="edit-invoice-btn"><Edit3 size={12} className="mr-1" /> Edit Invoice</Button>
                )}
              </div>
              <div className="space-y-1 text-sm">
                <Row label="Subtotal" value={fmtKWD(job.subtotal)} />
                <Row label="Discount" value={`- ${fmtKWD(job.discount)}`} />
                <Row label={`Tax (${job.tax_rate}%)`} value={fmtKWD(job.tax_amount)} />
                <div className="border-t border-border pt-2 mt-2"><Row label="Total" value={fmtKWD(job.total)} bold /></div>
                <Row label="Paid" value={fmtKWD(job.total_paid)} />
                <Row label="Balance Due" value={fmtKWD(job.balance_due)} accent={job.balance_due > 0.001 ? "#FFCC00" : "#00FF66"} />
              </div>
            </div>
          </div>

          {/* PAYMENTS */}
          <div className="border border-border bg-[#0F1115] rounded-sm">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard size={14} className="text-[#3385FF]" />
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Payments</div>
              </div>
              {canRecordPayment && (
                <Button size="sm" onClick={() => setPayOpen(true)} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="record-payment-btn"><Plus size={12} className="mr-1" /> Record Payment</Button>
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr className="border-b border-border"><th className="text-left px-6 py-2">Method</th><th className="text-left px-6 py-2">Auth Code</th><th className="text-left px-6 py-2">Notes</th><th className="text-left px-6 py-2">Date</th><th className="text-right px-6 py-2">Amount</th><th /></tr>
              </thead>
              <tbody data-testid="payments-list">
                {(job.payments || []).map(p => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="px-6 py-2"><span className="text-[11px] uppercase tracking-wider font-semibold">{p.method.replace("_", " ")}</span></td>
                    <td className="px-6 py-2 font-mono-data text-xs">{p.auth_code || "—"}</td>
                    <td className="px-6 py-2 text-muted-foreground text-xs">{p.notes || "—"}</td>
                    <td className="px-6 py-2 text-muted-foreground text-xs">{fmtDateTime(p.recorded_at)}</td>
                    <td className="px-6 py-2 text-right font-mono-data font-semibold">{fmtKWD(p.amount)}</td>
                    <td className="px-6 py-2 text-right">{user?.role === "admin" && <button onClick={() => deletePayment(p.id)} className="text-muted-foreground hover:text-[#FF3B30]"><Trash2 size={12} /></button>}</td>
                  </tr>
                ))}
                {(!job.payments || job.payments.length === 0) && <tr><td colSpan={6} className="px-6 py-4 text-center text-sm text-muted-foreground">No payments recorded.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* CHECKLIST */}
          <div className="border border-border bg-[#0F1115] rounded-sm">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Technician Checklist</div>
              {(!job.checklist || job.checklist.length === 0) && canEdit && <Button onClick={seedChecklist} size="sm" className="bg-[#0066FF]/10 text-[#3385FF] border border-[#0066FF]/40 rounded-sm">Use default</Button>}
            </div>
            <div className="divide-y divide-border" data-testid="checklist">
              {(job.checklist || []).map((it, i) => (
                <div key={i} className="px-6 py-3 flex items-center gap-3">
                  <Checkbox checked={it.done} onCheckedChange={() => canEdit && toggleItem(i)} disabled={!canEdit} className="border-border" />
                  <div className={`flex-1 text-sm ${it.done ? "line-through text-muted-foreground" : ""}`}>{it.label}</div>
                  {canEdit && <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-[#FF3B30]"><Trash2 size={14} /></button>}
                </div>
              ))}
              {canEdit && (
                <div className="px-6 py-3 flex gap-2">
                  <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add checklist item…" className="bg-background border-border rounded-sm h-9" />
                  <Button onClick={addItem} size="sm" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm"><Plus size={14} /></Button>
                </div>
              )}
              {(!job.checklist || job.checklist.length === 0) && !canEdit && <div className="px-6 py-4 text-sm text-muted-foreground">No checklist yet.</div>}
            </div>
          </div>

          {/* PHOTOS */}
          <div className="grid md:grid-cols-2 gap-4">
            <PhotoBlock title="Before" photos={job.before_photos} canEdit={canEdit} onClick={() => beforeRef.current?.click()} />
            <PhotoBlock title="After" photos={job.after_photos} canEdit={canEdit} onClick={() => afterRef.current?.click()} />
            <input ref={beforeRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload("before", e.target.files[0])} />
            <input ref={afterRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload("after", e.target.files[0])} />
          </div>
        </div>

        <div className="space-y-4">
          {/* TIMER */}
          <div className="border border-border bg-[#0F1115] rounded-sm p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Job Timer</div>
            <div className="font-display text-3xl font-black font-mono-data">{fmtSeconds(liveSeconds)}</div>
            {canEdit && job.status !== "completed" && job.status !== "cancelled" && (
              <div className="mt-3 flex gap-2">
                {!job.timer_running ? (
                  <Button size="sm" onClick={timerStart} className="bg-emerald-600 hover:bg-emerald-500 rounded-sm" data-testid="timer-start"><Play size={12} className="mr-1" /> Start</Button>
                ) : (
                  <Button size="sm" onClick={timerStop} className="bg-[#FF3B30] hover:bg-red-500 rounded-sm" data-testid="timer-stop"><Square size={12} className="mr-1" /> Stop</Button>
                )}
              </div>
            )}
          </div>

          {/* ASSIGNMENT */}
          <div className="border border-border bg-[#0F1115] rounded-sm p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Assigned Technician</div>
            {(user?.role === "admin" || user?.role === "sales") ? (
              <Select value={job.technician_id || ""} onValueChange={assign}>
                <SelectTrigger className="bg-background border-border rounded-sm" data-testid="assign-tech-select"><SelectValue placeholder="— Unassigned —" /></SelectTrigger>
                <SelectContent className="bg-[#0F1115] border-border">
                  {techs.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="font-semibold">{job.technician?.name || "—"}</div>
            )}
          </div>

          <div className="border border-border bg-[#0F1115] rounded-sm p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Vehicle Info</div>
            <dl className="text-sm space-y-1">
              <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd className="capitalize">{job.vehicle?.vehicle_type}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Year</dt><dd>{job.vehicle?.year || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Color</dt><dd>{job.vehicle?.color || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">VIN</dt><dd className="font-mono-data text-xs">{job.vehicle?.vin || "—"}</dd></div>
            </dl>
          </div>

          <div className="border border-border bg-[#0F1115] rounded-sm p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Customer</div>
            <div className="font-semibold">{job.customer?.name}</div>
            <div className="text-sm text-muted-foreground font-mono-data">{job.customer?.mobile}</div>
            {job.customer?.email && <div className="text-sm text-muted-foreground">{job.customer.email}</div>}
          </div>
        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={savePayment} className="space-y-3 mt-2" data-testid="payment-form">
            <div className="text-xs text-muted-foreground">Balance Due: <span className="font-mono-data text-white font-semibold">{fmtKWD(job.balance_due)}</span></div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider">Method *</Label>
              <Select value={payment.method} onValueChange={(v) => setPayment({...payment, method: v})}>
                <SelectTrigger className="mt-1 bg-background border-border rounded-sm" data-testid="payment-method"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0F1115] border-border">
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="knet">K-net</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-[10px] uppercase tracking-wider">Amount (KWD) *</Label><Input type="number" step="0.001" required value={payment.amount} onChange={e => setPayment({...payment, amount: e.target.value})} className="mt-1 bg-background border-border rounded-sm" data-testid="payment-amount" /></div>
            {(payment.method === "knet" || payment.method === "credit_card") && (
              <div><Label className="text-[10px] uppercase tracking-wider">Auth Code *</Label><Input required value={payment.auth_code} onChange={e => setPayment({...payment, auth_code: e.target.value})} className="mt-1 bg-background border-border rounded-sm" data-testid="payment-auth" /></div>
            )}
            <div><Label className="text-[10px] uppercase tracking-wider">Notes</Label><Input value={payment.notes} onChange={e => setPayment({...payment, notes: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setPayment({...payment, amount: job.balance_due.toString()})} className="border-border rounded-sm text-xs">Pay Full Balance</Button>
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 rounded-sm" data-testid="payment-save">Record Payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT INVOICE MODAL */}
      <Dialog open={invoiceEditOpen} onOpenChange={setInvoiceEditOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">Edit Invoice</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label className="text-[10px] uppercase tracking-wider">Discount (KWD)</Label><Input type="number" step="0.001" value={invDiscount} onChange={e => setInvDiscount(e.target.value)} className="mt-1 bg-background border-border rounded-sm" data-testid="inv-discount" /></div>
            <div><Label className="text-[10px] uppercase tracking-wider">Tax Rate (%)</Label><Input type="number" step="0.01" value={invTax} onChange={e => setInvTax(e.target.value)} className="mt-1 bg-background border-border rounded-sm" /></div>
            <div><Label className="text-[10px] uppercase tracking-wider">Notes</Label><Input value={invNotes} onChange={e => setInvNotes(e.target.value)} className="mt-1 bg-background border-border rounded-sm" /></div>
            <DialogFooter className="pt-3">
              <Button variant="outline" onClick={() => setInvoiceEditOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button onClick={saveInvoiceEdit} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="inv-save">Save Invoice</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Row = ({ label, value, bold, accent }) => (
  <div className="flex items-center justify-between">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`font-mono-data ${bold ? "text-xl font-black" : "text-sm"}`} style={accent ? { color: accent } : {}}>{value}</div>
  </div>
);

const PaymentStatusBadge = ({ status }) => {
  const map = {
    unpaid: { label: "UNPAID", color: "#FF3B30", bg: "rgba(255,59,48,0.08)" },
    partial: { label: "PARTIAL", color: "#FFCC00", bg: "rgba(255,204,0,0.08)" },
    paid: { label: "PAID", color: "#00FF66", bg: "rgba(0,255,102,0.08)" },
  };
  const s = map[status] || map.unpaid;
  return <span className="tag-status" style={{ color: s.color, background: s.bg, borderColor: s.color }} data-testid={`pay-status-${status}`}>{s.label}</span>;
};

const PhotoBlock = ({ title, photos = [], canEdit, onClick }) => (
  <div className="border border-border bg-[#0F1115] rounded-sm p-5">
    <div className="flex items-center justify-between mb-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{title} Photos ({photos.length})</div>
      {canEdit && <button onClick={onClick} className="text-xs text-[#3385FF] hover:underline flex items-center gap-1" data-testid={`upload-${title.toLowerCase()}-btn`}><Upload size={12} /> Upload</button>}
    </div>
    {photos.length === 0 ? <div className="aspect-video bg-background border border-dashed border-border rounded-sm flex items-center justify-center text-xs text-muted-foreground">No photos</div> :
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => <a key={i} href={fileUrl(p)} target="_blank" rel="noreferrer"><img src={fileUrl(p)} alt="" className="aspect-square w-full object-cover rounded-sm border border-border" /></a>)}
      </div>
    }
  </div>
);
