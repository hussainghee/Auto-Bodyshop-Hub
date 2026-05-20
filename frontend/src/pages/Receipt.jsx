import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, fmtKWD, fmtDateTime } from "../lib/api";
import { Button } from "../components/ui/button";
import { Printer } from "lucide-react";
import { printDocument } from "../lib/print";
import WetworksLogo from "../assets/Wetworks-Logo.jpeg";

const METHOD_LABEL = {
  cash: "Cash",
  knet: "K-net",
  credit_card: "Credit Card",
  other: "Other",
};
const COMPANY_PHONE = "+965 9991 9614";

export default function Receipt() {
  const { jid, pid } = useParams();
  const [job, setJob] = useState(null);

  useEffect(() => {
    api.get(`/jobs/${jid}`).then(r => setJob(r.data)).catch(() => setJob(null));
  }, [jid]);

  if (!job) {
    return (
      <div className="p-8 text-muted-foreground bg-background min-h-screen">
        Loading…
      </div>
    );
  }

  const payment = (job.payments || []).find(p => p.id === pid);

  if (!payment) {
    return (
      <div className="p-8 text-muted-foreground bg-background min-h-screen">
        Payment not found.
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen text-foreground receipt-page">
      <div className="receipt-screen-wrapper">
        <div className="flex items-center justify-between mb-4 no-print">
          <Link
            to={`/jobs/${jid}`}
            className="text-sm text-muted-foreground hover:text-white"
          >
            ← Back to Job
          </Link>

          <Button
            onClick={printDocument}
            className="bg-[#8771B2] hover:bg-[#7662A3] rounded-sm"
            data-testid="print-receipt-btn"
          >
            <Printer size={14} className="mr-1.5" /> Print Receipt
          </Button>
        </div>

        <div
          id="print-area"
          className="receipt-print-sheet bg-white text-[#111111] border border-[#D8D0EA] rounded-sm"
          data-testid="receipt-card"
        >
          <div className="print-brand-bar">
            <div className="print-brand-layout">
              <div className="print-brand-identity">
                <img
                  src={WetworksLogo}
                  alt="WETWORKS Detailing Center"
                  className="print-logo"
                />

                <div>
                  <div className="print-company-name">WETWORKS</div>
                  <div className="print-company-subtitle">DETAILING CENTER</div>
                  <div className="print-contact-line">
                    Kuwait · {COMPANY_PHONE}
                  </div>
                </div>
              </div>

              <div className="print-document-meta">
                <div className="print-document-label">Payment Receipt</div>
                <div className="print-document-number">
                  {payment.id.slice(0, 8).toUpperCase()}
                </div>
                <div className="text-xs text-[#6B7280] mt-1">
                  {fmtDateTime(payment.recorded_at)}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-[#6B7280] mt-2">
                  Against {job.invoice_number || job.number}
                </div>
              </div>
            </div>
          </div>

          <div className="print-info-grid">
            <div className="print-info-card">
              <div className="print-section-title">Received From</div>
              <div className="font-semibold mt-2">{job.customer?.name}</div>
              <div className="text-sm text-[#6B7280] font-mono-data">
                {job.customer?.mobile}
              </div>
            </div>

            <div className="print-info-card">
              <div className="print-section-title">Vehicle</div>
              <div className="font-semibold mt-2">
                {job.vehicle?.make} {job.vehicle?.model}
              </div>
              <div className="text-sm text-[#6B7280] font-mono-data">
                Plate: {job.vehicle?.plate || "—"}
              </div>
            </div>
          </div>

          <div className="receipt-amount-box">
            <div>
              <div className="print-section-title">Amount Received</div>
              <div className="receipt-main-amount">
                {fmtKWD(payment.amount)}
              </div>
            </div>

            <div className="text-right">
              <div className="print-section-title">Method</div>
              <div className="font-display text-xl font-bold mt-1">
                {METHOD_LABEL[payment.method] || payment.method}
              </div>

              {payment.auth_code && (
                <div className="mt-2">
                  <div className="print-section-title">Auth Code</div>
                  <div className="text-sm font-mono-data">
                    {payment.auth_code}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="receipt-stat-grid">
            <Stat label="Invoice Total" value={fmtKWD(job.total)} />
            <Stat label="Total Paid" value={fmtKWD(job.total_paid)} />
            <Stat
              label="Balance Due"
              value={fmtKWD(job.balance_due)}
              accent={job.balance_due > 0.001 ? "#B42318" : "#008A3D"}
            />
          </div>

          {payment.notes && (
            <div className="mt-5 border-t border-[#D8D0EA] pt-3">
              <div className="print-section-title">Notes</div>
              <div className="text-sm mt-1">{payment.notes}</div>
            </div>
          )}

          <div className="print-document-footer">
            <div>
                  <div className="font-semibold text-[#111111]">
                    WETWORKS Detailing Center
                  </div>
                  <div>Kuwait · {COMPANY_PHONE}</div>
                </div>

            <div className="text-right font-semibold text-[#111111]">
              Thank you for your business.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Stat = ({ label, value, accent }) => (
  <div className="receipt-stat-card">
    <div className="print-section-title">{label}</div>
    <div
      className="font-mono-data font-bold mt-1"
      style={accent ? { color: accent } : {}}
    >
      {value}
    </div>
  </div>
);
