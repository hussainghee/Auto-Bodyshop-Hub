import { fmtKWD, fmtDate } from "../lib/api";
import WetworksLogo from "../assets/Wetworks-Logo.jpeg";

const BRAND = {
  name: "WETWORKS",
  subtitle: "DETAILING CENTER",
};

export default function BrandedDocument({
  kind = "quotation",
  title,
  subtitle,
  meta = [],
  status,
  customer,
  vehicle,
  lines = [],
  totals = {},
  payments,
  notes,
  terms = [],
  footer,
}) {
  const isInvoice = kind === "invoice";
  const showDiscount = (totals.discount || 0) > 0;
  const showTax = (totals.tax_rate || 0) > 0 || (totals.tax_amount || 0) > 0;

  return (
    <div
      id="print-area"
      className="quotation-print-sheet bg-white text-[#111111] rounded-sm mx-auto print:bg-white print-page font-sans"
      style={{ fontFamily: "'IBM Plex Sans', Arial, sans-serif" }}
    >
      <div className="print-brand-bar">
        <div className="print-brand-layout">
          <div className="print-brand-identity">
            <img
              src={WetworksLogo}
              alt="WETWORKS Detailing Center"
              className="print-logo"
            />

            <div className="min-w-0">
              <div className="print-company-name">{BRAND.name}</div>
              <div className="print-company-subtitle">{BRAND.subtitle}</div>
              <div className="print-contact-line">
                Kuwait · +965 0000 0000 · hello@wetworks.kw
              </div>
            </div>
          </div>

          <div className="print-document-meta">
            <div className="print-document-label">
              {subtitle || (isInvoice ? "Invoice" : "Quotation")}
            </div>

            <div className="print-document-number">{title}</div>

            <dl className="print-meta-list">
              {meta.map((m, i) => (
                <div key={i} className="flex justify-end gap-3">
                  <dt className="uppercase tracking-wider text-[#6B7280] text-[10px]">
                    {m.label}
                  </dt>
                  <dd className="text-[#111111] font-semibold">{m.value}</dd>
                </div>
              ))}
            </dl>

            {status && <div className="print-status-row">{status}</div>}
          </div>
        </div>
      </div>

      <div className="print-info-grid">
        <InfoCard title="Bill To">
          <div className="text-base font-bold text-[#111111]">
            {customer?.name || "—"}
          </div>

          {customer?.mobile && (
            <div className="text-sm text-[#4B5563] font-mono">
              {customer.mobile}
            </div>
          )}

          {customer?.email && (
            <div className="text-sm text-[#4B5563] break-words">
              {customer.email}
            </div>
          )}

          {customer?.address && (
            <div className="text-sm text-[#4B5563] break-words">
              {customer.address}
            </div>
          )}

          {customer?.city && (
            <div className="text-sm text-[#4B5563]">{customer.city}</div>
          )}
        </InfoCard>

        <InfoCard title="Vehicle">
          <div className="text-base font-bold text-[#111111] break-words">
            {vehicle?.make} {vehicle?.model}{" "}
            {vehicle?.year ? `· ${vehicle.year}` : ""}
          </div>

          {vehicle?.vehicle_type && (
            <div className="text-sm text-[#4B5563] capitalize">
              {vehicle.vehicle_type}
              {vehicle.color ? ` · ${vehicle.color}` : ""}
            </div>
          )}

          <div className="text-xs text-[#4B5563] font-mono mt-1 break-words">
            Plate: {vehicle?.plate || "—"}
            {vehicle?.vin ? ` · VIN: ${vehicle.vin}` : ""}
          </div>
        </InfoCard>
      </div>

      <div className="print-table-wrap border border-[#D8D0EA] rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="print-table-head">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold uppercase tracking-wider text-[11px]">
                Service
              </th>
              <th className="text-right px-4 py-2.5 font-semibold uppercase tracking-wider text-[11px] w-20">
                Qty
              </th>
              <th className="text-right px-4 py-2.5 font-semibold uppercase tracking-wider text-[11px] w-32">
                Unit Price
              </th>
              <th className="text-right px-4 py-2.5 font-semibold uppercase tracking-wider text-[11px] w-32">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-[#E5E7EB] last:border-b-0">
                <td className="px-4 py-3">
                  <div className="font-semibold text-[#111111] break-words">
                    {l.service_name}
                  </div>

                  {l.description && (
                    <div className="text-xs text-[#6B7280] mt-0.5 break-words">
                      {l.description}
                    </div>
                  )}

                  {l.selected_areas?.length > 0 && (
                    <div className="text-[11px] text-[#6B7280] mt-0.5">
                      Areas: {l.selected_areas.length} selected
                    </div>
                  )}
                </td>

                <td className="px-4 py-3 text-right font-mono text-[#111111]">
                  {l.quantity}
                </td>

                <td className="px-4 py-3 text-right font-mono text-[#111111]">
                  {fmtKWD(l.unit_price)}
                </td>

                <td className="px-4 py-3 text-right font-mono font-semibold text-[#111111]">
                  {fmtKWD(l.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mt-4">
        <div className="w-full sm:w-80 border border-[#D8D0EA] rounded-sm overflow-hidden">
          <SummaryRow label="Subtotal" value={fmtKWD(totals.subtotal)} />

          {showDiscount && (
            <SummaryRow
              label={`Discount${
                totals.discount_type === "percent" && totals.discount_value
                  ? ` (${totals.discount_value}%)`
                  : ""
              }`}
              value={`- ${fmtKWD(totals.discount)}`}
              accent
            />
          )}

          {showTax && (
            <SummaryRow
              label={`Tax (${totals.tax_rate}%)`}
              value={fmtKWD(totals.tax_amount)}
            />
          )}

          <div className="print-total-row">
            <div className="text-[11px] uppercase tracking-wider font-bold">
              {isInvoice ? "Total Due" : "Grand Total"}
            </div>

            <div className="font-mono text-2xl font-black">
              {fmtKWD(totals.total)}
            </div>
          </div>

          {isInvoice && (
            <>
              <SummaryRow label="Paid" value={fmtKWD(totals.total_paid)} positive />

              <SummaryRow
                label="Balance Due"
                value={fmtKWD(totals.balance_due)}
                negative={(totals.balance_due || 0) > 0.001}
              />
            </>
          )}
        </div>
      </div>

      {isInvoice && payments && payments.length > 0 && (
        <div className="mt-6">
          <div className="print-section-title">Payments Received</div>

          <div className="print-table-wrap border border-[#D8D0EA] rounded-sm overflow-hidden mt-2">
            <table className="w-full text-xs">
              <thead className="bg-[#F4F1FA] text-[#111111]">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">
                    Method
                  </th>
                  <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider">
                    Auth Code
                  </th>
                  <th className="text-right px-3 py-2 font-semibold uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-[#E5E7EB]">
                    <td className="px-3 py-2 text-[#4B5563]">
                      {fmtDate(p.recorded_at)}
                    </td>

                    <td className="px-3 py-2 capitalize">
                      {(p.method || "").replace("_", " ")}
                    </td>

                    <td className="px-3 py-2 font-mono text-[#4B5563]">
                      {p.auth_code || "—"}
                    </td>

                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {fmtKWD(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {notes && (
        <div className="mt-6 border-t border-[#D8D0EA] pt-4">
          <div className="print-section-title">Notes</div>
          <div className="text-sm text-[#111111] whitespace-pre-line mt-2 break-words">
            {notes}
          </div>
        </div>
      )}

      {terms.length > 0 && (
        <div className="mt-6 border-t border-[#D8D0EA] pt-4">
          <div className="print-section-title">Terms & Conditions</div>

          <ol className="text-[11px] text-[#4B5563] space-y-1 list-decimal list-inside mt-2">
            {terms.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="print-document-footer">
        <div>
          <div className="font-semibold text-[#111111] mb-0.5">
            WETWORKS Detailing Center
          </div>
          <div>Kuwait · +965 0000 0000</div>
          <div>www.wetworks.kw · hello@wetworks.kw</div>
        </div>

        <div className="text-right">
          {footer || (
            <div>
              <div className="font-semibold text-[#111111]">
                Thank you for choosing WETWORKS.
              </div>
              <div className="text-[10px] text-[#6B7280] mt-1">
                This document is system generated and valid subject to inspection
                and final approval.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const InfoCard = ({ title, children }) => (
  <div className="print-info-card">
    <div className="print-section-title">{title}</div>
    <div className="mt-2">{children}</div>
  </div>
);

const SummaryRow = ({ label, value, accent, positive, negative }) => (
  <div className="flex items-center justify-between px-4 py-2 border-b border-[#E5E7EB] last:border-b-0">
    <div className="text-xs text-[#6B7280]">{label}</div>
    <div
      className={`font-mono text-sm font-semibold ${
        accent ? "text-[#B42318]" : ""
      } ${positive ? "text-emerald-600" : ""} ${
        negative ? "text-[#B42318]" : ""
      }`}
    >
      {value}
    </div>
  </div>
);
