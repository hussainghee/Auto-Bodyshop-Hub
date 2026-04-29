import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, fmtKWD, fmtDateTime } from "../lib/api";
import { Button } from "../components/ui/button";
import { Printer } from "lucide-react";

const METHOD_LABEL = { cash: "Cash", knet: "K-net", credit_card: "Credit Card" };

export default function Receipt() {
  const { jid, pid } = useParams();
  const [job, setJob] = useState(null);

  useEffect(() => {
    api.get(`/jobs/${jid}`).then(r => setJob(r.data)).catch(() => setJob(null));
  }, [jid]);

  if (!job) return <div className="p-8 text-muted-foreground bg-background min-h-screen">Loading…</div>;

  const payment = (job.payments || []).find(p => p.id === pid);
  if (!payment) return <div className="p-8 text-muted-foreground bg-background min-h-screen">Payment not found.</div>;

  return (
    <div className="bg-background min-h-screen text-foreground">
      <div className="max-w-2xl mx-auto p-8">
        <div className="flex items-center justify-between mb-4 no-print">
          <Link to={`/jobs/${jid}`} className="text-sm text-muted-foreground hover:text-white">← Back to Job</Link>
          <Button onClick={() => window.print()} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="print-receipt-btn"><Printer size={14} className="mr-1.5" /> Print Receipt</Button>
        </div>

        <div className="bg-[#0F1115] border border-border rounded-sm p-8 print:bg-white print:border-0 print:p-0" data-testid="receipt-card">
          <div className="flex items-start justify-between border-b border-border pb-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Payment Receipt</div>
              <div className="font-display text-3xl font-black tracking-tighter mt-1 font-mono-data">{payment.id.slice(0, 8).toUpperCase()}</div>
              <div className="text-sm text-muted-foreground mt-1">{fmtDateTime(payment.recorded_at)}</div>
            </div>
            <div className="text-right">
              <div className="font-display text-xl font-black tracking-tighter">wetworks</div>
              <div className="text-xs text-muted-foreground mt-1">Salmiya, Kuwait</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">Against {job.invoice_number || job.number}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 my-6">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Received From</div>
              <div className="font-semibold">{job.customer?.name}</div>
              <div className="text-sm text-muted-foreground font-mono-data">{job.customer?.mobile}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Vehicle</div>
              <div className="font-semibold">{job.vehicle?.make} {job.vehicle?.model}</div>
              <div className="text-sm text-muted-foreground font-mono-data">Plate: {job.vehicle?.plate || "—"}</div>
            </div>
          </div>

          <div className="border-t border-b border-border py-6 my-6 flex items-end justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Amount Received</div>
              <div className="font-display text-5xl font-black tracking-tighter font-mono-data mt-1">{fmtKWD(payment.amount)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Method</div>
              <div className="font-display text-xl font-bold mt-1">{METHOD_LABEL[payment.method] || payment.method}</div>
              {payment.auth_code && (
                <div className="mt-2">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Auth Code</div>
                  <div className="text-sm font-mono-data">{payment.auth_code}</div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Stat label="Invoice Total" value={fmtKWD(job.total)} />
            <Stat label="Total Paid" value={fmtKWD(job.total_paid)} />
            <Stat label="Balance Due" value={fmtKWD(job.balance_due)} accent={job.balance_due > 0.001 ? "#FFCC00" : "#00FF66"} />
          </div>

          {payment.notes && (
            <div className="mt-6 border-t border-border pt-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Notes</div>
              <div className="text-sm">{payment.notes}</div>
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-border text-[10px] uppercase tracking-widest text-muted-foreground text-center">
            Thank you for your business
          </div>
        </div>
      </div>
    </div>
  );
}

const Stat = ({ label, value, accent }) => (
  <div className="border border-border rounded-sm p-3">
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    <div className="font-mono-data font-bold mt-1" style={accent ? { color: accent } : {}}>{value}</div>
  </div>
);
