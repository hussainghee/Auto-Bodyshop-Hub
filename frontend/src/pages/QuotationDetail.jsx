import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, fmtKWD, fmtDate, waLink } from "../lib/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Printer, Send, X, MessageCircle, Hourglass, ArrowRight, Edit3, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export default function QuotationDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [q, setQ] = useState(null);

  // edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [lines, setLines] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [services, setServices] = useState([]);
  const [addServiceId, setAddServiceId] = useState("");

  const load = async () => { const { data } = await api.get(`/quotations/${id}`); setQ(data); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const openEdit = async () => {
    if (!services.length) {
      const r = await api.get("/services"); setServices(r.data);
    }
    setLines(q.lines.map(l => ({ ...l })));
    setDiscount(q.discount || 0);
    setTaxRate(q.tax_rate || 0);
    setValidUntil(q.valid_until || "");
    setNotes(q.notes || "");
    setAddServiceId("");
    setEditOpen(true);
  };

  const updateLine = (i, patch) => {
    setLines(lines.map((l, idx) => idx === i ? {
      ...l, ...patch,
      line_total: round3((patch.quantity ?? l.quantity) * (patch.unit_price ?? l.unit_price)),
    } : l));
  };
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  const addLineFromService = () => {
    const svc = services.find(s => s.id === addServiceId);
    if (!svc) return;
    const vtKey = q.vehicle?.vehicle_type;
    let unit = 0;
    if (svc.pricing_mode === "fixed") unit = svc.fixed_price || 0;
    else if (svc.pricing_mode === "per_vehicle_type") unit = svc.vehicle_type_prices?.[vtKey] || 0;
    else if (svc.pricing_mode === "full_vehicle") unit = svc.full_vehicle_prices?.[vtKey] || 0;
    // per_panel / per_glass_area: user will set price manually
    setLines([...lines, {
      service_id: svc.id, service_name: svc.name, description: svc.description,
      quantity: 1, unit_price: round3(unit), line_total: round3(unit),
      selected_areas: [],
    }]);
    setAddServiceId("");
  };

  const subtotal = useMemo(() => round3(lines.reduce((s, l) => s + l.line_total, 0)), [lines]);
  const taxAmount = round3(Math.max(subtotal - discount, 0) * (taxRate / 100));
  const total = round3(Math.max(subtotal - discount, 0) + taxAmount);

  const saveEdit = async () => {
    if (lines.length === 0) { toast.error("Quotation must have at least one line"); return; }
    try {
      await api.patch(`/quotations/${id}`, {
        customer_id: q.customer_id, vehicle_id: q.vehicle_id,
        lines, discount: Number(discount), tax_rate: Number(taxRate),
        notes, valid_until: validUntil || null,
      });
      toast.success("Quotation updated");
      setEditOpen(false);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const setStatus = async (status) => {
    await api.post(`/quotations/${id}/status`, { status });
    toast.success(`Marked ${status}`);
    load();
  };

  const convert = async () => {
    const { data } = await api.post(`/quotations/${id}/convert`);
    toast.success(`Job ${data.number} created`);
    nav(`/jobs/${data.id}`);
  };

  if (!q) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const canEdit = q.status === "draft" || q.status === "sent";
  const waMsg = `Hello ${q.customer?.name}, your quotation ${q.number} is ready. Total: ${fmtKWD(q.total)}.`;

  return (
    <div data-testid="quotation-detail-page">
      <PageHeader title={q.number} subtitle="Quotation"
        actions={<>
          <Link to="/quotations" className="no-print"><Button variant="outline" className="border-border rounded-sm">← Back</Button></Link>
          {canEdit && <Button onClick={openEdit} variant="outline" className="border-border rounded-sm no-print" data-testid="edit-quotation-btn"><Edit3 size={14} className="mr-1.5" /> Edit</Button>}
          {q.customer?.mobile && <a href={waLink(q.customer.mobile, waMsg)} target="_blank" rel="noreferrer" className="no-print"><Button variant="outline" className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 rounded-sm"><MessageCircle size={14} className="mr-1.5" /> Share</Button></a>}
          <Button onClick={() => window.print()} variant="outline" className="border-border rounded-sm no-print"><Printer size={14} className="mr-1.5" /> Print PDF</Button>
          {q.status === "draft" && <Button onClick={() => setStatus("sent")} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm no-print" data-testid="mark-sent-btn"><Send size={14} className="mr-1.5" /> Mark Sent</Button>}
          {q.status !== "approved" && q.status !== "rejected" && <Button onClick={() => setStatus("approved")} className="bg-emerald-600 hover:bg-emerald-500 rounded-sm no-print" data-testid="mark-approved-btn">Mark Approved</Button>}
          {q.status !== "rejected" && q.status !== "approved" && <Button onClick={() => setStatus("rejected")} variant="outline" className="border-[#FF3B30] text-[#FF3B30] rounded-sm no-print"><X size={14} className="mr-1" /> Reject</Button>}
          {q.status === "approved" && <Button onClick={convert} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm no-print" data-testid="convert-btn">Convert to Job <ArrowRight size={14} className="ml-1.5" /></Button>}
        </>}
      />
      <div className="p-8 print-page">
        <div className="bg-[#0F1115] border border-border rounded-sm p-8 max-w-4xl mx-auto print:bg-white print:border-0 print:p-0" id="print-area">
          <div className="flex items-start justify-between border-b border-border pb-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Quotation</div>
              <div className="font-display text-4xl font-black tracking-tighter mt-1">{q.number}</div>
              <div className="text-sm text-muted-foreground mt-1">Issued {fmtDate(q.created_at)}</div>
              {q.valid_until && <div className="text-sm text-muted-foreground">Valid until {fmtDate(q.valid_until)}</div>}
            </div>
            <div className="text-right">
              <div className="font-display text-xl font-black tracking-tighter">AUTO/CRM Workshop</div>
              <div className="text-xs text-muted-foreground mt-1">Salmiya, Kuwait</div>
              <div className="mt-2 flex justify-end gap-2">
                <StatusBadge status={q.status} />
                {q.is_expired && <span className="tag-status" style={{ color: "#FF3B30", background: "rgba(255,59,48,0.08)", borderColor: "#FF3B30" }}><Hourglass size={10} className="inline mr-1" />EXPIRED</span>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 my-6">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Bill To</div>
              <div className="font-semibold">{q.customer?.name}</div>
              <div className="text-sm text-muted-foreground font-mono-data">{q.customer?.mobile}</div>
              <div className="text-sm text-muted-foreground">{q.customer?.email}</div>
              <div className="text-sm text-muted-foreground">{q.customer?.address}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Vehicle</div>
              <div className="font-semibold">{q.vehicle?.make} {q.vehicle?.model} {q.vehicle?.year || ""}</div>
              <div className="text-sm text-muted-foreground capitalize">{q.vehicle?.vehicle_type} · {q.vehicle?.color}</div>
              <div className="text-sm text-muted-foreground font-mono-data">Plate: {q.vehicle?.plate || "—"} · VIN: {q.vehicle?.vin || "—"}</div>
            </div>
          </div>

          <table className="w-full text-sm border-t border-border">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground"><tr className="border-b border-border"><th className="text-left py-3">Service</th><th className="text-right py-3">Qty</th><th className="text-right py-3">Unit</th><th className="text-right py-3">Total</th></tr></thead>
            <tbody>
              {q.lines.map((l, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="py-3"><div className="font-semibold">{l.service_name}</div>{l.selected_areas?.length > 0 && <div className="text-[11px] text-muted-foreground">{l.selected_areas.length} areas selected</div>}</td>
                  <td className="py-3 text-right font-mono-data">{l.quantity}</td>
                  <td className="py-3 text-right font-mono-data">{fmtKWD(l.unit_price)}</td>
                  <td className="py-3 text-right font-mono-data font-semibold">{fmtKWD(l.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto md:w-80 mt-4">
            <div className="flex justify-between py-1 text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono-data">{fmtKWD(q.subtotal)}</span></div>
            <div className="flex justify-between py-1 text-sm"><span className="text-muted-foreground">Discount</span><span className="font-mono-data">- {fmtKWD(q.discount)}</span></div>
            <div className="flex justify-between py-1 text-sm"><span className="text-muted-foreground">Tax ({q.tax_rate}%)</span><span className="font-mono-data">{fmtKWD(q.tax_amount)}</span></div>
            <div className="flex justify-between py-3 border-t border-border mt-1"><span className="text-xs uppercase tracking-widest font-bold">Total</span><span className="font-mono-data text-2xl font-black">{fmtKWD(q.total)}</span></div>
          </div>

          {q.notes && <div className="mt-6 border-t border-border pt-4"><div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Notes</div><div className="text-sm">{q.notes}</div></div>}
        </div>
      </div>

      {/* EDIT MODAL */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">Edit Quotation {q.number}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2" data-testid="quotation-edit-form">
            <div className="border border-border rounded-sm">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]"><tr className="border-b border-border"><th className="text-left px-4 py-2">Service</th><th className="text-right px-4 py-2">Qty</th><th className="text-right px-4 py-2">Unit</th><th className="text-right px-4 py-2">Total</th><th /></tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b border-border/60">
                      <td className="px-4 py-2">
                        <div className="font-semibold">{l.service_name}</div>
                        {l.selected_areas?.length > 0 && <div className="text-[11px] text-muted-foreground">{l.selected_areas.length} areas</div>}
                      </td>
                      <td className="px-4 py-2 text-right"><Input type="number" step="0.01" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} className="w-20 bg-background border-border rounded-sm h-8 text-sm text-right" data-testid={`edit-line-qty-${i}`} /></td>
                      <td className="px-4 py-2 text-right"><Input type="number" step="0.001" value={l.unit_price} onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })} className="w-24 bg-background border-border rounded-sm h-8 text-sm text-right" /></td>
                      <td className="px-4 py-2 text-right font-mono-data font-semibold">{fmtKWD(l.line_total)}</td>
                      <td className="px-4 py-2 text-right"><button onClick={() => removeLine(i)} className="text-muted-foreground hover:text-[#FF3B30]" data-testid={`edit-remove-line-${i}`}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                  {lines.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-6">No lines. Add one below.</td></tr>}
                </tbody>
              </table>
              <div className="border-t border-border p-3 flex gap-2 items-center">
                <Select value={addServiceId} onValueChange={setAddServiceId}>
                  <SelectTrigger className="bg-background border-border rounded-sm h-9" data-testid="add-line-service"><SelectValue placeholder="Add a service…" /></SelectTrigger>
                  <SelectContent className="bg-[#0F1115] border-border">
                    {services.filter(s => s.active !== false).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" onClick={addLineFromService} disabled={!addServiceId} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm"><Plus size={14} className="mr-1" /> Add</Button>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div><Label className="text-[10px] uppercase tracking-wider">Discount (KWD)</Label><Input type="number" step="0.001" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="mt-1 bg-background border-border rounded-sm" data-testid="edit-discount" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Tax Rate (%)</Label><Input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="mt-1 bg-background border-border rounded-sm" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Valid Until</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="mt-1 bg-background border-border rounded-sm" /></div>
            </div>
            <div><Label className="text-[10px] uppercase tracking-wider">Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 bg-background border-border rounded-sm" /></div>
            <div className="border border-border rounded-sm p-4 ml-auto md:w-80">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono-data">{fmtKWD(subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount</span><span className="font-mono-data">- {fmtKWD(discount)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax ({taxRate}%)</span><span className="font-mono-data">{fmtKWD(taxAmount)}</span></div>
              <div className="flex justify-between py-2 border-t border-border mt-1"><span className="text-xs uppercase tracking-widest font-bold">Total</span><span className="font-mono-data text-2xl font-black">{fmtKWD(total)}</span></div>
            </div>
          </div>
          <DialogFooter className="pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="border-border rounded-sm">Cancel</Button>
            <Button onClick={saveEdit} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="edit-save">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
