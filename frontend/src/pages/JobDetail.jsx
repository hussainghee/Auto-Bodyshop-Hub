import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, fileUrl, fmtKWD, fmtDateTime, waLink } from "../lib/api";
import { useSystemSettings } from "../lib/settings";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import BrandedDocument from "../components/BrandedDocument";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, Upload, Trash2, Printer, CreditCard, Edit3, MessageCircle, Package, FileText, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

const NEXT_STATUS = { confirmed: "in_progress", in_progress: "completed" };
const INVOICE_TERMS = [
  "All work performed by Wetworks Automotive Care follows industry-standard procedures.",
  "Payments are due upon job completion unless otherwise agreed.",
  "Warranty on workmanship: 30 days. Warranty on materials follows manufacturer policy.",
  "Wetworks is not liable for items left inside the vehicle.",
];
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
  const settings = useSystemSettings();
  const waEnabled = !!settings?.toggles?.whatsapp_enabled;
  const [job, setJob] = useState(null);
  const [techs, setTechs] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [newItem, setNewItem] = useState("");
  const beforeRef = useRef(null);
  const afterRef = useRef(null);

  const [payOpen, setPayOpen] = useState(false);
  const [payment, setPayment] = useState({ method: "cash", amount: "", auth_code: "", notes: "" });

  const [invoiceEditOpen, setInvoiceEditOpen] = useState(false);
  const [invDiscountType, setInvDiscountType] = useState("amount");
  const [invDiscountValue, setInvDiscountValue] = useState(0);
  const [invTax, setInvTax] = useState(0);
  const [invNotes, setInvNotes] = useState("");

  const [consumeOpen, setConsumeOpen] = useState(false);
  const [consumeLineIdx, setConsumeLineIdx] = useState(null);
  const [consumeItems, setConsumeItems] = useState([]);
  const [consumeNewInv, setConsumeNewInv] = useState("");

  const [internalNotes, setInternalNotes] = useState("");
  const [internalSaving, setInternalSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get(`/jobs/${id}`);
    setJob(data);
    setInvDiscountType(data.discount_type || "amount");
    setInvDiscountValue(data.discount_value ?? data.discount ?? 0);
    setInvTax(data.tax_rate || 0);
    setInvNotes(data.notes || "");
    setInternalNotes(data.internal_notes || "");
    if (user?.role === "admin" || user?.role === "sales") {
      try {
        const { data: u } = await api.get("/users/technicians");
        setTechs(u);
      } catch {/* tech can't list */}
    }
    try {
      const { data: inv } = await api.get("/inventory");
      setInventory(inv);
    } catch {/* ignore */}
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

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
    toast.success("Assigned"); load();
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
    } catch (err) {
  console.error("Payment save failed:", err);
  toast.error(err?.response?.data?.detail || "Failed to record payment");
}
  };

  const deletePayment = async (pid) => {
    if (!window.confirm("Delete this payment?")) return;
    await api.delete(`/jobs/${id}/payments/${pid}`);
    load();
  };

  const saveInvoiceEdit = async () => {
    try {
      const dv = Number(invDiscountValue) || 0;
      const subtotal = (job?.lines || []).reduce((s, l) => s + (l.line_total || 0), 0);
      const discountAmt = invDiscountType === "percent" ? Math.round(subtotal * dv * 10) / 1000 : dv;
      await api.patch(`/jobs/${id}/invoice`, {
        discount: discountAmt,
        discount_type: invDiscountType,
        discount_value: dv,
        tax_rate: Number(invTax),
        notes: invNotes,
      });
      toast.success("Invoice updated");
      setInvoiceEditOpen(false);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  // CONSUMPTION
  const openConsume = (idx) => {
    setConsumeLineIdx(idx);
    setConsumeItems((job.lines[idx]?.consumed_inventory || []).map(c => ({ ...c })));
    setConsumeNewInv("");
    setConsumeOpen(true);
  };
  const addConsumeItem = () => {
    const inv = inventory.find(i => i.id === consumeNewInv);
    if (!inv) return;
    if (consumeItems.find(c => c.inventory_id === inv.id)) { toast.error("Already added"); return; }
    setConsumeItems([...consumeItems, {
      inventory_id: inv.id, sku: inv.sku, name: inv.name, unit: inv.unit, qty: 1, notes: "",
    }]);
    setConsumeNewInv("");
  };
  const updateConsumeItem = (i, patch) => setConsumeItems(consumeItems.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  const removeConsumeItem = (i) => setConsumeItems(consumeItems.filter((_, idx) => idx !== i));
  const saveConsume = async () => {
    try {
      await api.post(`/jobs/${id}/line-consumption`, {
        line_index: consumeLineIdx,
        consumed_inventory: consumeItems.map(c => ({
          inventory_id: c.inventory_id, sku: c.sku, name: c.name,
          qty: Number(c.qty) || 0, unit: c.unit || null, notes: c.notes || null,
        })),
      });
      toast.success("Materials saved");
      setConsumeOpen(false);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const saveInternalNotes = async () => {
    setInternalSaving(true);
    try {
      await api.patch(`/jobs/${id}/internal-notes`, { internal_notes: internalNotes });
      toast.success("Saved");
      load();
    } catch { toast.error("Failed"); }
    setInternalSaving(false);
  };

  if (!job) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const canEdit = user?.role !== "technician" || job.technician_id === user.id;
  const canRecordPayment = user?.role === "admin" || user?.role === "sales";
  const waMsg = `Hi ${job.customer?.name}, your ${job.invoice_number ? "invoice " + job.invoice_number : "job " + job.number} is ${job.status.replace("_", " ")}. Total ${fmtKWD(job.total)}${job.balance_due > 0 ? `. Balance due ${fmtKWD(job.balance_due)}` : ""}.`;

  return (
    <div data-testid="job-detail-page">
      <PageHeader title={job.invoice_number || job.number} subtitle={job.invoice_number ? "Tax Invoice" : "Job Card"}
        actions={<>
          <Link to="/jobs" className="no-print"><Button variant="outline" className="border-border rounded-sm">← Back</Button></Link>
          <Button onClick={() => window.print()} variant="outline" className="border-border rounded-sm no-print" data-testid="print-invoice"><Printer size={14} className="mr-1.5" /> Print {job.invoice_number ? "Invoice" : "Job Card"}</Button>
          {job.customer?.mobile && waEnabled && (
            <a href={waLink(job.customer.mobile, waMsg)} target="_blank" rel="noreferrer" className="no-print">
              <Button variant="outline" className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 rounded-sm" data-testid="wa-share-invoice"><MessageCircle size={14} className="mr-1.5" /> WhatsApp</Button>
            </a>
          )}
          {canEdit && NEXT_STATUS[job.status] && <Button onClick={advance} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm no-print" data-testid="advance-status-btn">Mark {NEXT_STATUS[job.status].replace("_", " ")} →</Button>}
          {canEdit && job.status !== "completed" && job.status !== "cancelled" && <Button onClick={() => setStatus("cancelled")} variant="outline" className="border-[#FF3B30] text-[#FF3B30] rounded-sm no-print">Cancel Job</Button>}
        </>}
      />

      <div className="p-4 sm:p-8 grid lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* PRINTABLE BRANDED INVOICE */}
          <div className="print-page">
            <BrandedDocument
              kind="invoice"
              title={job.invoice_number || job.number}
              subtitle={job.invoice_number ? "Tax Invoice" : "Job Card"}
              meta={[
                { label: "Job #", value: job.number },
                ...(job.quotation_number ? [{ label: "Quotation #", value: job.quotation_number }] : []),
                { label: "Date", value: fmtDateTime(job.completed_at || job.created_at) },
                ...(job.created_by_name ? [{ label: "Created By", value: job.created_by_name }] : []),
                ...(job.technician?.name ? [{ label: "Technician", value: job.technician.name }] : []),
              ]}
              status={
                <div className="flex gap-2">
                  <StatusBadge status={job.status} />
                  <PaymentStatusBadge status={job.payment_status} />
                </div>
              }
              customer={job.customer}
              vehicle={job.vehicle}
              lines={job.lines}
              totals={job}
              payments={job.payments}
              notes={job.notes}
              terms={INVOICE_TERMS}
            />
            {canRecordPayment && (
              <div className="no-print mt-3 flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setInvoiceEditOpen(true)} className="border-border rounded-sm" data-testid="edit-invoice-btn"><Edit3 size={12} className="mr-1.5" /> Edit Invoice</Button>
              </div>
            )}
          </div>

          {/* MATERIALS / CONSUMPTION — INTERNAL */}
          <InternalSection title="Materials & Consumption (per service)" sub="Internal — not shown on customer invoice">
            <div className="divide-y divide-border">
              {job.lines.map((l, i) => {
                const items = l.consumed_inventory || [];
                return (
                  <div key={i} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">{l.service_name}</div>
                      {canEdit && <Button size="sm" variant="outline" onClick={() => openConsume(i)} className="border-border rounded-sm text-xs" data-testid={`edit-consumption-${i}`}><Edit3 size={12} className="mr-1" /> Mark materials</Button>}
                    </div>
                    {items.length > 0 ? (
                      <div className="mt-2 grid gap-1">
                        {items.map((c, ci) => (
                          <div key={ci} className="text-xs text-muted-foreground flex items-start gap-3 bg-background border border-border rounded-sm p-2">
                            <Package size={12} className="mt-0.5 text-[#FFCC00]" />
                            <div className="flex-1">
                              <div className="text-sm text-white font-mono-data">{c.qty} {c.unit || ""} · <span className="font-semibold">{c.name}</span> {c.sku && <span className="text-muted-foreground">({c.sku})</span>}</div>
                              {c.notes && <div className="text-xs text-muted-foreground mt-0.5 italic">“{c.notes}”</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-1">No materials marked yet.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </InternalSection>

          {/* INTERNAL NOTES */}
          <InternalSection title="Internal Notes" sub="Workshop notes — not shown on customer invoice">
            <div className="p-6 space-y-2">
              <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)}
                disabled={!canEdit} rows={4}
                placeholder="E.g. PPF-001 roll: 2.4m used, 0.6m remainder stored labeled Batch-A14. Tint film: 1/2 roll used."
                className="w-full bg-background border border-border rounded-sm text-sm p-3 font-mono-data disabled:opacity-70"
                data-testid="internal-notes-textarea" />
              {canEdit && (
                <Button size="sm" onClick={saveInternalNotes} disabled={internalSaving} className="bg-[#FFCC00]/20 hover:bg-[#FFCC00]/30 text-[#FFCC00] border border-[#FFCC00]/40 rounded-sm" data-testid="save-internal-notes">
                  {internalSaving ? "Saving…" : "Save Notes"}
                </Button>
              )}
            </div>
          </InternalSection>

          {/* PAYMENTS (no-print) */}
          <div className="border border-border bg-[#0F1115] rounded-sm no-print">
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
                    <td className="px-6 py-2 text-right flex items-center gap-2 justify-end">
                      <Link to={`/jobs/${id}/receipts/${p.id}`} className="text-[#3385FF] text-xs hover:underline flex items-center gap-1" data-testid={`receipt-link-${p.id}`}><FileText size={12} /> Receipt</Link>
                      {user?.role === "admin" && <button onClick={() => deletePayment(p.id)} className="text-muted-foreground hover:text-[#FF3B30]"><Trash2 size={12} /></button>}
                    </td>
                  </tr>
                ))}
                {(!job.payments || job.payments.length === 0) && <tr><td colSpan={6} className="px-6 py-4 text-center text-sm text-muted-foreground">No payments recorded.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* CHECKLIST (no-print) */}
          <div className="border border-border bg-[#0F1115] rounded-sm no-print">
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

          {/* PHOTOS (no-print) */}
          <div className="grid md:grid-cols-2 gap-4 no-print">
            <PhotoBlock title="Before" photos={job.before_photos} canEdit={canEdit} onClick={() => beforeRef.current?.click()} />
            <PhotoBlock title="After" photos={job.after_photos} canEdit={canEdit} onClick={() => afterRef.current?.click()} />
            <input ref={beforeRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload("before", e.target.files[0])} />
            <input ref={afterRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload("after", e.target.files[0])} />
          </div>
        </div>

        <div className="space-y-4 no-print">
          {(job.quotation_number || job.created_by_name) && (
            <div className="border border-border bg-[#0F1115] rounded-sm p-5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Job Info</div>
              <dl className="text-sm space-y-2">
                {job.quotation_number && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">Quotation</dt>
                    <dd>
                      {job.quotation_id
                        ? <Link to={`/quotations/${job.quotation_id}`} className="text-[#3385FF] hover:underline font-mono-data" data-testid="job-linked-quotation">{job.quotation_number}</Link>
                        : <span className="font-mono-data">{job.quotation_number}</span>}
                    </dd>
                  </div>
                )}
                {job.created_by_name && <div className="flex justify-between"><dt className="text-muted-foreground">Created by</dt><dd className="font-semibold" data-testid="job-creator">{job.created_by_name}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted-foreground">Created at</dt><dd>{fmtDateTime(job.created_at)}</dd></div>
                {job.completed_at && <div className="flex justify-between"><dt className="text-muted-foreground">Completed</dt><dd>{fmtDateTime(job.completed_at)}</dd></div>}
              </dl>
            </div>
          )}

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

      {/* PAYMENT MODAL */}
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
                  {settings?.toggles?.payment_cash !== false && <SelectItem value="cash">Cash</SelectItem>}
                  {settings?.toggles?.payment_knet !== false && <SelectItem value="knet">K-net</SelectItem>}
                  {settings?.toggles?.payment_card !== false && <SelectItem value="credit_card">Credit Card</SelectItem>}
                  {settings?.toggles?.payment_bank_transfer && <SelectItem value="bank_transfer">Bank Transfer</SelectItem>}
                  {settings?.toggles?.payment_other && <SelectItem value="other">Other</SelectItem>}
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

      {/* INVOICE EDIT MODAL */}
      <Dialog open={invoiceEditOpen} onOpenChange={setInvoiceEditOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">Edit Invoice</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] uppercase tracking-wider">Discount Type</Label>
                <Select value={invDiscountType} onValueChange={setInvDiscountType}>
                  <SelectTrigger className="mt-1 bg-background border-border rounded-sm" data-testid="inv-discount-type"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0F1115] border-border">
                    <SelectItem value="amount">Fixed (KWD)</SelectItem>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider">Discount Value</Label>
                <Input type="number" step="0.001" value={invDiscountValue} onChange={e => setInvDiscountValue(e.target.value)} className="mt-1 bg-background border-border rounded-sm" data-testid="inv-discount-value" />
              </div>
            </div>
            <div><Label className="text-[10px] uppercase tracking-wider">Tax Rate (%)</Label><Input type="number" step="0.01" value={invTax} onChange={e => setInvTax(e.target.value)} className="mt-1 bg-background border-border rounded-sm" /></div>
            <div><Label className="text-[10px] uppercase tracking-wider">Notes</Label><Input value={invNotes} onChange={e => setInvNotes(e.target.value)} className="mt-1 bg-background border-border rounded-sm" /></div>
            <DialogFooter className="pt-3">
              <Button variant="outline" onClick={() => setInvoiceEditOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button onClick={saveInvoiceEdit} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="inv-save">Save Invoice</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* CONSUMPTION MODAL */}
      <Dialog open={consumeOpen} onOpenChange={setConsumeOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-black tracking-tighter">
              Mark Materials Used
              {consumeLineIdx !== null && <span className="text-sm font-normal text-muted-foreground ml-2">for {job.lines[consumeLineIdx]?.service_name}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2" data-testid="consume-form">
            <div className="text-xs text-muted-foreground">Internal record — these details are <strong>NOT</strong> shown to the customer on the invoice or quotation. Upon job completion, stock is auto-deducted based on these entries.</div>
            <div className="border border-border rounded-sm">
              <div className="px-3 py-2 border-b border-border flex gap-2 items-center">
                <Select value={consumeNewInv} onValueChange={setConsumeNewInv}>
                  <SelectTrigger className="bg-background border-border rounded-sm h-9 flex-1" data-testid="consume-inv-select"><SelectValue placeholder="Select inventory item…" /></SelectTrigger>
                  <SelectContent className="bg-[#0F1115] border-border max-h-[300px]">
                    {inventory.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.name} — {inv.sku} ({inv.stock_qty} {inv.unit} left)</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" onClick={addConsumeItem} disabled={!consumeNewInv} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm"><Plus size={14} className="mr-1" /> Add</Button>
              </div>
              <div className="divide-y divide-border">
                {consumeItems.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">No materials marked. Select from catalog to add.</div>}
                {consumeItems.map((c, i) => (
                  <div key={i} className="p-3 grid grid-cols-[1fr_100px_1fr_auto] gap-2 items-start">
                    <div>
                      <div className="font-semibold text-sm">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono-data">{c.sku}</div>
                    </div>
                    <Input type="number" step="0.01" value={c.qty} onChange={e => updateConsumeItem(i, { qty: e.target.value })} className="bg-background border-border rounded-sm h-9" placeholder="Qty" data-testid={`consume-qty-${i}`} />
                    <Input value={c.notes || ""} onChange={e => updateConsumeItem(i, { notes: e.target.value })} className="bg-background border-border rounded-sm h-9" placeholder="Notes (e.g. leftover 0.6m stored)" data-testid={`consume-notes-${i}`} />
                    <button type="button" onClick={() => removeConsumeItem(i)} className="text-muted-foreground hover:text-[#FF3B30] mt-2"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConsumeOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button onClick={saveConsume} className="bg-[#FFCC00]/20 hover:bg-[#FFCC00]/30 text-[#FFCC00] border border-[#FFCC00]/40 rounded-sm" data-testid="consume-save">Save Materials</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const InternalSection = ({ title, sub, children }) => (
  <div className="border border-[#FFCC00]/30 bg-[#FFCC00]/5 rounded-sm no-print">
    <div className="px-6 py-3 border-b border-[#FFCC00]/30 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Lock size={12} className="text-[#FFCC00]" />
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#FFCC00] font-semibold">{title}</div>
          {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
      </div>
      <span className="tag-status" style={{ color: "#FFCC00", background: "rgba(255,204,0,0.08)", borderColor: "#FFCC00" }}>INTERNAL</span>
    </div>
    {children}
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
