import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, fmtKWD, fmtDate, waLink } from "../lib/api";
import { useSystemSettings } from "../lib/settings";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import BrandedDocument from "../components/BrandedDocument";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Printer, X, MessageCircle, Hourglass, ArrowRight, Edit3, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;

const QUOTATION_TERMS = [
  "Quotation valid until the stated date. Pricing may change after expiry.",
  "Materials, paint colours and tint shades may vary slightly from samples.",
  "Vehicle must be delivered clean for accurate panel inspection.",
  "Approved jobs require a 30% advance to lock in scheduling.",
  "Wetworks is not liable for items left inside the vehicle.",
];

export default function QuotationDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const settings = useSystemSettings();
  const waEnabled = !!settings?.toggles?.whatsapp_enabled;
  const [q, setQ] = useState(null);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [lines, setLines] = useState([]);
  const [discountType, setDiscountType] = useState("amount");
  const [discountValue, setDiscountValue] = useState(0);
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
    setDiscountType(q.discount_type || "amount");
    setDiscountValue(q.discount_value ?? q.discount ?? 0);
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
    setLines([...lines, {
      service_id: svc.id, service_name: svc.name, description: svc.description,
      quantity: 1, unit_price: round3(unit), line_total: round3(unit),
      selected_areas: [],
    }]);
    setAddServiceId("");
  };

  const subtotal = useMemo(() => round3(lines.reduce((s, l) => s + l.line_total, 0)), [lines]);
  const discountAmount = useMemo(() => {
    const v = Number(discountValue) || 0;
    return discountType === "percent" ? round3(subtotal * Math.max(v, 0) / 100) : round3(Math.max(v, 0));
  }, [subtotal, discountType, discountValue]);
  const taxAmount = round3(Math.max(subtotal - discountAmount, 0) * (taxRate / 100));
  const total = round3(Math.max(subtotal - discountAmount, 0) + taxAmount);

  const saveEdit = async () => {
    if (lines.length === 0) { toast.error("Quotation must have at least one line"); return; }
    try {
      await api.patch(`/quotations/${id}`, {
        customer_id: q.customer_id, vehicle_id: q.vehicle_id,
        lines,
        discount: discountAmount,
        discount_type: discountType,
        discount_value: Number(discountValue) || 0,
        tax_rate: Number(taxRate),
        notes, valid_until: validUntil || null,
      });
      toast.success("Quotation updated");
      setEditOpen(false);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  // Mark Approved → backend auto-creates job card → navigate
  const markApproved = async () => {
    try {
      const { data } = await api.post(`/quotations/${id}/status`, { status: "approved" });
      toast.success(data.job_number ? `Approved · Job ${data.job_number} created` : "Approved");
      if (data.job_id) {
        nav(`/jobs/${data.job_id}`);
      } else {
        load();
      }
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const markRejected = async () => {
    await api.post(`/quotations/${id}/status`, { status: "rejected" });
    toast.success("Rejected");
    load();
  };

  if (!q) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const canEdit = q.status === "draft";
  const waMsg = `Hello ${q.customer?.name || ""}, your Wetworks quotation ${q.number} is ready. Total: ${fmtKWD(q.total)}.`;
  const meta = [
    { label: "Issue Date", value: fmtDate(q.created_at) },
    ...(q.valid_until ? [{ label: "Valid Until", value: fmtDate(q.valid_until) }] : []),
    ...(q.created_by_name ? [{ label: "Created By", value: q.created_by_name }] : []),
  ];

  return (
    <div data-testid="quotation-detail-page">
      <PageHeader
        title={q.number}
        subtitle="Quotation"
        actions={<>
          <Link to="/quotations" className="no-print"><Button variant="outline" className="border-border rounded-sm">← Back</Button></Link>
          {canEdit && <Button onClick={openEdit} variant="outline" className="border-border rounded-sm no-print" data-testid="edit-quotation-btn"><Edit3 size={14} className="mr-1.5" /> Edit</Button>}
          {q.customer?.mobile && waEnabled && <a href={waLink(q.customer.mobile, waMsg)} target="_blank" rel="noreferrer" className="no-print"><Button variant="outline" className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 rounded-sm" data-testid="wa-share-quotation"><MessageCircle size={14} className="mr-1.5" /> WhatsApp</Button></a>}
            <Button
  onClick={() => {
    document.body.classList.add("printing-document");
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove("printing-document");
      }, 500);
    }, 100);
  }}
  variant="outline"
  className="border-border rounded-sm no-print"
  data-testid="print-quotation"
>
  <Printer size={14} className="mr-1.5" /> Print PDF
</Button>
          {q.status !== "approved" && q.status !== "rejected" && (
            <Button onClick={markApproved} className="bg-emerald-600 hover:bg-emerald-500 rounded-sm no-print" data-testid="mark-approved-btn">Mark Approved</Button>
          )}
          {q.status !== "rejected" && q.status !== "approved" && (
            <Button onClick={markRejected} variant="outline" className="border-[#FF3B30] text-[#FF3B30] rounded-sm no-print" data-testid="mark-rejected-btn"><X size={14} className="mr-1" /> Reject</Button>
          )}
          {q.status === "approved" && q.linked_job_id && (
            <Link to={`/jobs/${q.linked_job_id}`} className="no-print">
              <Button className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="open-job-btn">Open Job {q.linked_job_number} <ArrowRight size={14} className="ml-1.5" /></Button>
            </Link>
          )}
        </>}
      />

      <div className="p-4 sm:p-8 print-page">
        <BrandedDocument
          kind="quotation"
          title={q.number}
          subtitle="Quotation"
          meta={meta}
          status={
            <div className="flex gap-2">
              <StatusBadge status={q.status} />
              {q.is_expired && <span className="tag-status" style={{ color: "#FF3B30", background: "rgba(255,59,48,0.08)", borderColor: "#FF3B30" }}><Hourglass size={10} className="inline mr-1" />EXPIRED</span>}
            </div>
          }
          customer={q.customer}
          vehicle={q.vehicle}
          lines={q.lines}
          totals={q}
          notes={q.notes}
          terms={QUOTATION_TERMS}
        />
      </div>

      {/* EDIT MODAL */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-4xl max-h-[92vh] overflow-y-auto w-[calc(100vw-1.5rem)] sm:w-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">Edit Quotation {q.number}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2" data-testid="quotation-edit-form">
            <div className="border border-border rounded-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2">Service</th>
                    <th className="text-right px-4 py-2 w-20">Qty</th>
                    <th className="text-right px-4 py-2 w-28">Unit Price</th>
                    <th className="text-right px-4 py-2 w-28">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b border-border/60">
                      <td className="px-4 py-2"><div className="font-semibold">{l.service_name}</div>{l.selected_areas?.length > 0 && <div className="text-[11px] text-muted-foreground">{l.selected_areas.length} areas</div>}</td>
                      <td className="px-4 py-2"><Input type="number" step="0.01" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} className="w-full bg-background border-border rounded-sm h-8 text-sm text-right" data-testid={`edit-line-qty-${i}`} /></td>
                      <td className="px-4 py-2"><Input type="number" step="0.001" value={l.unit_price} onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })} className="w-full bg-background border-border rounded-sm h-8 text-sm text-right" /></td>
                      <td className="px-4 py-2 text-right font-mono-data font-semibold">{fmtKWD(l.line_total)}</td>
                      <td className="px-2 py-2 text-right"><button onClick={() => removeLine(i)} className="text-muted-foreground hover:text-[#FF3B30]" data-testid={`edit-remove-line-${i}`}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                  {lines.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-6">No lines. Add one below.</td></tr>}
                </tbody>
              </table>
              <div className="border-t border-border p-3 flex flex-wrap gap-2 items-center">
                <Select value={addServiceId} onValueChange={setAddServiceId}>
                  <SelectTrigger className="bg-background border-border rounded-sm h-9 flex-1 min-w-[200px]" data-testid="add-line-service"><SelectValue placeholder="Add a service…" /></SelectTrigger>
                  <SelectContent className="bg-[#0F1115] border-border max-h-[300px]">
                    {services.filter(s => s.active !== false).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" onClick={addLineFromService} disabled={!addServiceId} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm"><Plus size={14} className="mr-1" /> Add</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[10px] uppercase tracking-wider">Discount Type</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger className="mt-1 bg-background border-border rounded-sm" data-testid="edit-discount-type"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0F1115] border-border">
                    <SelectItem value="amount">Fixed (KWD)</SelectItem>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider">Discount Value</Label>
                <Input type="number" step="0.001" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="mt-1 bg-background border-border rounded-sm" data-testid="edit-discount-value" />
              </div>
              <div><Label className="text-[10px] uppercase tracking-wider">Tax Rate (%)</Label><Input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="mt-1 bg-background border-border rounded-sm" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-[10px] uppercase tracking-wider">Valid Until</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="mt-1 bg-background border-border rounded-sm" /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 bg-background border-border rounded-sm" /></div>
            </div>
            <div className="border border-border rounded-sm p-4 ml-auto sm:w-80">
              <SummaryRow label="Subtotal" value={fmtKWD(subtotal)} />
              {discountAmount > 0 && <SummaryRow label={`Discount${discountType === "percent" ? ` (${discountValue}%)` : ""}`} value={`- ${fmtKWD(discountAmount)}`} />}
              {taxRate > 0 && <SummaryRow label={`Tax (${taxRate}%)`} value={fmtKWD(taxAmount)} />}
              <div className="border-t border-border mt-2 pt-2"><SummaryRow label="Total" value={fmtKWD(total)} big /></div>
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

const SummaryRow = ({ label, value, big }) => (
  <div className="flex items-center justify-between py-1">
    <div className={`${big ? "text-sm uppercase tracking-widest text-muted-foreground font-semibold" : "text-xs text-muted-foreground"}`}>{label}</div>
    <div className={`font-mono-data ${big ? "text-2xl font-black" : "text-sm"}`}>{value}</div>
  </div>
);
