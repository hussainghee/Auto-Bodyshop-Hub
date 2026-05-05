import { fmtKWD, fmtDate } from "../lib/api";

const LOGO = "https://customer-assets.emergentagent.com/job_vehicle-care-crm/artifacts/d5acrado_Wetworks-Logo.jpeg";

/**
 * Branded, print-ready document used for both quotations and invoices.
 *
 * Props:
 *  kind: "quotation" | "invoice"
 *  title: e.g. "QT-00001" or "INV-00001"
 *  subtitle: small label above title (e.g. "Quotation" / "Invoice")
 *  meta: array of { label, value } shown top-right
 *  status: optional badge node
 *  customer, vehicle: objects with relevant fields
 *  lines: [{ service_name, selected_areas, quantity, unit_price, line_total }]
 *  totals: { subtotal, discount, discount_type, discount_value, tax_rate, tax_amount, total, total_paid?, balance_due? }
 *  payments: optional array (invoice only)
 *  notes: free text
 *  terms: array of strings
 *  footer: jsx footer
 */
export default function BrandedDocument({
  kind = "quotation", title, subtitle, meta = [], status,
  customer, vehicle, lines = [], totals = {}, payments,
  notes, terms = [], footer,
}) {
  const isInvoice = kind === "invoice";
  const showDiscount = (totals.discount || 0) > 0;
  const showTax = (totals.tax_rate || 0) > 0 || (totals.tax_amount || 0) > 0;

  return (
    <div
      id="print-area"
      className="bg-white text-[#0a0b0e] rounded-sm max-w-4xl mx-auto p-8 sm:p-10 print:p-0 print:max-w-none print:bg-white print-page font-sans"
      style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* Brand header */}
      <div className="flex items-start justify-between gap-6 pb-6 border-b-2 border-[#0066FF] print-divider">
        <div className="flex items-center gap-4 min-w-0">
          <img src={LOGO} alt="Wetworks" className="w-16 h-16 rounded object-cover border border-zinc-200" />
          <div className="min-w-0">
            <div className="font-display text-3xl font-black tracking-tight text-[#0a0b0e] print-accent">WETWORKS</div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 print-muted mt-1">Automotive Care · Kuwait</div>
            <div className="text-xs text-zinc-600 print-muted mt-2 leading-tight">
              Salmiya, Block 10 · Kuwait<br />
              +965 0000 0000 · hello@wetworks.kw
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 print-muted">{subtitle || (isInvoice ? "Tax Invoice" : "Quotation")}</div>
          <div className="font-display text-3xl sm:text-4xl font-black tracking-tighter text-[#0a0b0e] mt-1">{title}</div>
          <dl className="mt-3 space-y-1 text-xs">
            {meta.map((m, i) => (
              <div key={i} className="flex justify-end gap-3">
                <dt className="uppercase tracking-wider text-zinc-500 print-muted text-[10px]">{m.label}</dt>
                <dd className="text-[#0a0b0e] font-semibold">{m.value}</dd>
              </div>
            ))}
          </dl>
          {status && <div className="mt-3 flex justify-end">{status}</div>}
        </div>
      </div>

      {/* Bill-to / Vehicle */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 print-muted mb-2 font-semibold">Bill To</div>
          <div className="text-base font-bold text-[#0a0b0e]">{customer?.name || "—"}</div>
          {customer?.mobile && <div className="text-sm text-zinc-700 print-muted font-mono">{customer.mobile}</div>}
          {customer?.email && <div className="text-sm text-zinc-700 print-muted">{customer.email}</div>}
          {customer?.address && <div className="text-sm text-zinc-700 print-muted">{customer.address}</div>}
          {customer?.city && <div className="text-sm text-zinc-700 print-muted">{customer.city}</div>}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 print-muted mb-2 font-semibold">Vehicle</div>
          <div className="text-base font-bold text-[#0a0b0e]">
            {vehicle?.make} {vehicle?.model} {vehicle?.year ? `· ${vehicle.year}` : ""}
          </div>
          {vehicle?.vehicle_type && <div className="text-sm text-zinc-700 print-muted capitalize">{vehicle.vehicle_type}{vehicle.color ? ` · ${vehicle.color}` : ""}</div>}
          <div className="text-xs text-zinc-700 print-muted font-mono mt-1">
            Plate: {vehicle?.plate || "—"}{vehicle?.vin ? `  ·  VIN: ${vehicle.vin}` : ""}
          </div>
        </div>
      </div>

      {/* Lines table */}
      <div className="border border-zinc-200 print-divider rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0066FF] text-white print-accent-bg">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold uppercase tracking-wider text-[11px]">Service</th>
              <th className="text-right px-4 py-2.5 font-semibold uppercase tracking-wider text-[11px] w-20">Qty</th>
              <th className="text-right px-4 py-2.5 font-semibold uppercase tracking-wider text-[11px] w-32">Unit Price</th>
              <th className="text-right px-4 py-2.5 font-semibold uppercase tracking-wider text-[11px] w-32">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-zinc-200 print-divider last:border-b-0">
                <td className="px-4 py-3">
                  <div className="font-semibold text-[#0a0b0e]">{l.service_name}</div>
                  {l.description && <div className="text-xs text-zinc-600 print-muted mt-0.5">{l.description}</div>}
                  {l.selected_areas?.length > 0 && (
                    <div className="text-[11px] text-zinc-600 print-muted mt-0.5">
                      Areas: {l.selected_areas.length} selected
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[#0a0b0e]">{l.quantity}</td>
                <td className="px-4 py-3 text-right font-mono text-[#0a0b0e]">{fmtKWD(l.unit_price)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-[#0a0b0e]">{fmtKWD(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mt-4">
        <div className="w-full sm:w-80 border border-zinc-200 print-divider rounded-sm overflow-hidden">
          <SummaryRow label="Subtotal" value={fmtKWD(totals.subtotal)} />
          {showDiscount && (
            <SummaryRow
              label={`Discount${totals.discount_type === "percent" && totals.discount_value ? ` (${totals.discount_value}%)` : ""}`}
              value={`- ${fmtKWD(totals.discount)}`}
              accent
            />
          )}
          {showTax && <SummaryRow label={`Tax (${totals.tax_rate}%)`} value={fmtKWD(totals.tax_amount)} />}
          <div className="bg-[#0066FF] text-white print-accent-bg px-4 py-3 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider font-bold">{isInvoice ? "Total Due" : "Grand Total"}</div>
            <div className="font-mono text-2xl font-black">{fmtKWD(totals.total)}</div>
          </div>
          {isInvoice && (
            <>
              <SummaryRow label="Paid" value={fmtKWD(totals.total_paid)} positive />
              <SummaryRow label="Balance Due" value={fmtKWD(totals.balance_due)} negative={(totals.balance_due || 0) > 0.001} />
            </>
          )}
        </div>
      </div>

      {/* Payments table (invoice only) */}
      {isInvoice && payments && payments.length > 0 && (
        <div className="mt-6">
          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 print-muted mb-2 font-semibold">Payments Received</div>
          <div className="border border-zinc-200 print-divider rounded-sm overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-zinc-100 text-zinc-700">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Date</th>
                  <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Method</th>
                  <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">Auth Code</th>
                  <th className="text-right px-3 py-2 font-semibold uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-zinc-200 print-divider">
                    <td className="px-3 py-2 text-zinc-700">{fmtDate(p.recorded_at)}</td>
                    <td className="px-3 py-2 capitalize">{(p.method || "").replace("_", " ")}</td>
                    <td className="px-3 py-2 font-mono text-zinc-700">{p.auth_code || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{fmtKWD(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notes */}
      {notes && (
        <div className="mt-6 border-t border-zinc-200 print-divider pt-4">
          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 print-muted mb-1 font-semibold">Notes</div>
          <div className="text-sm text-[#0a0b0e] whitespace-pre-line">{notes}</div>
        </div>
      )}

      {/* Terms */}
      {terms.length > 0 && (
        <div className="mt-6 border-t border-zinc-200 print-divider pt-4">
          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 print-muted mb-2 font-semibold">Terms & Conditions</div>
          <ol className="text-[11px] text-zinc-700 print-muted space-y-1 list-decimal list-inside">
            {terms.map((t, i) => <li key={i}>{t}</li>)}
          </ol>
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-zinc-200 print-divider flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 text-[11px] text-zinc-600 print-muted">
        <div>
          <div className="font-semibold text-[#0a0b0e] mb-0.5">Wetworks Automotive Care</div>
          <div>Salmiya, Block 10 · Kuwait · +965 0000 0000</div>
          <div>www.wetworks.kw · hello@wetworks.kw</div>
        </div>
        <div className="text-right">
          {footer || <div className="font-semibold text-[#0a0b0e]">Thank you for choosing Wetworks.</div>}
        </div>
      </div>
    </div>
  );
}

const SummaryRow = ({ label, value, accent, positive, negative }) => (
  <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 print-divider last:border-b-0">
    <div className="text-xs text-zinc-600 print-muted">{label}</div>
    <div
      className={`font-mono text-sm font-semibold ${accent ? "text-[#FF3B30]" : ""} ${positive ? "text-emerald-600" : ""} ${negative ? "text-[#FF3B30]" : ""}`}
    >{value}</div>
  </div>
);
