import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, fmtKWD, fmtDate, waLink } from "../lib/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Printer, Send, X, MessageCircle, Hourglass, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function QuotationDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [q, setQ] = useState(null);

  const load = async () => { const { data } = await api.get(`/quotations/${id}`); setQ(data); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

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

  const waMsg = `Hello ${q.customer?.name}, your quotation ${q.number} is ready. Total: ${fmtKWD(q.total)}.`;

  return (
    <div data-testid="quotation-detail-page">
      <PageHeader title={q.number} subtitle="Quotation"
        actions={<>
          <Link to="/quotations" className="no-print"><Button variant="outline" className="border-border rounded-sm">← Back</Button></Link>
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
    </div>
  );
}
