import { useEffect, useState } from "react";
import { api, fmtKWD, downloadCSV, fmtDate } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Download, Filter } from "lucide-react";

const METHOD_COLORS = { cash: "#00FF66", knet: "#0066FF", credit_card: "#FFCC00" };

export default function Reports() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [sales, setSales] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [inv, setInv] = useState(null);

  const load = async () => {
    const params = {};
    if (start) params.start = start;
    if (end) params.end = end;
    const [s, p, j, i] = await Promise.all([
      api.get("/reports/sales", { params }),
      api.get("/reports/pnl", { params }).catch(() => ({ data: null })),
      api.get("/reports/jobs", { params }),
      api.get("/reports/inventory"),
    ]);
    setSales(s.data); setPnl(p.data); setJobs(j.data); setInv(i.data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const setPreset = (days) => {
    const d = new Date();
    const s = new Date(d); s.setDate(s.getDate() - days);
    setStart(s.toISOString().slice(0, 10));
    setEnd(d.toISOString().slice(0, 10));
  };

  const downloadSales = () => {
    if (!sales?.jobs) return;
    downloadCSV(`sales_${start || "all"}_${end || "all"}.csv`,
      sales.jobs.map(j => ({
        number: j.invoice_number || j.number,
        date: fmtDate(j.completed_at || j.updated_at),
        customer_id: j.customer_id,
        vehicle_id: j.vehicle_id,
        subtotal: j.subtotal,
        discount: j.discount,
        tax: j.tax_amount,
        total: j.total,
      })));
  };

  const downloadPnl = () => {
    if (!pnl) return;
    downloadCSV(`pnl_${start || "all"}_${end || "all"}.csv`, [pnl]);
  };

  const downloadInventory = () => {
    if (!inv?.items) return;
    downloadCSV("inventory.csv", inv.items);
  };

  return (
    <div data-testid="reports-page">
      <PageHeader title="Reports" subtitle="Analytics" />
      <div className="p-8 space-y-6">
        <div className="border border-border bg-[#0F1115] rounded-sm p-4 flex flex-wrap items-end gap-3">
          <Filter size={14} className="text-muted-foreground mb-2" />
          <div><Label className="text-[10px] uppercase tracking-wider">Start Date</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 bg-background border-border rounded-sm h-9" data-testid="report-start" /></div>
          <div><Label className="text-[10px] uppercase tracking-wider">End Date</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 bg-background border-border rounded-sm h-9" data-testid="report-end" /></div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPreset(7)} className="border-border rounded-sm">7D</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset(30)} className="border-border rounded-sm">30D</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset(90)} className="border-border rounded-sm">90D</Button>
          </div>
          <Button onClick={load} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm ml-auto" data-testid="report-apply">Apply</Button>
        </div>

        {/* KPI CARDS */}
        <div className="grid lg:grid-cols-4 gap-4">
          <Kpi label="Revenue" value={sales ? fmtKWD(sales.total_revenue) : "—"} hint={`${sales?.jobs?.length || 0} completed jobs`} />
          <Kpi label="Collected" value={sales ? fmtKWD(sales.total_collected) : "—"} />
          <Kpi label="Discounts Given" value={pnl ? fmtKWD(pnl.discounts_given) : "—"} />
          <Kpi label="Gross Profit" value={pnl ? fmtKWD(pnl.gross_profit) : "—"} accent="#00FF66" />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* P&L */}
          <div className="border border-border bg-[#0F1115] rounded-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Profit &amp; Loss</div>
              <Button size="sm" variant="outline" onClick={downloadPnl} className="border-border rounded-sm"><Download size={12} className="mr-1" /> CSV</Button>
            </div>
            {pnl ? (
              <div className="space-y-2 text-sm">
                <Row label="Revenue" value={fmtKWD(pnl.revenue)} />
                <Row label="Discounts Given" value={`- ${fmtKWD(pnl.discounts_given)}`} />
                <Row label="Tax Collected" value={fmtKWD(pnl.tax_collected)} />
                <Row label="COGS (Materials Used)" value={`- ${fmtKWD(pnl.cogs)}`} />
                <div className="border-t border-border pt-2 mt-2">
                  <Row label="Gross Profit" value={fmtKWD(pnl.gross_profit)} big accent="#00FF66" />
                </div>
                <div className="text-[11px] text-muted-foreground mt-3">Based on {pnl.job_count} completed jobs. Add operational expenses manually for full net profit.</div>
              </div>
            ) : <div className="text-sm text-muted-foreground">P&amp;L requires admin role.</div>}
          </div>

          {/* Sales by method */}
          <div className="border border-border bg-[#0F1115] rounded-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Payment Methods</div>
            </div>
            <div className="h-56">
              {sales?.by_method ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sales.by_method.filter(m => m.amount > 0)} dataKey="amount" nameKey="method" outerRadius={80} label>
                      {sales.by_method.map((entry, i) => <Cell key={i} fill={METHOD_COLORS[entry.method] || "#0066FF"} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#0F1115", border: "1px solid #272A30" }} formatter={(v) => fmtKWD(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="text-sm text-muted-foreground">No data.</div>}
            </div>
          </div>

          {/* Sales by service */}
          <div className="border border-border bg-[#0F1115] rounded-sm p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Sales by Service</div>
              <Button size="sm" variant="outline" onClick={downloadSales} className="border-border rounded-sm" data-testid="download-sales"><Download size={12} className="mr-1" /> Sales CSV</Button>
            </div>
            <div className="h-64">
              {sales?.by_service?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sales.by_service}>
                    <CartesianGrid stroke="#1A1D24" vertical={false} />
                    <XAxis dataKey="service" stroke="#A1A1AA" fontSize={10} />
                    <YAxis stroke="#A1A1AA" fontSize={10} />
                    <Tooltip contentStyle={{ background: "#0F1115", border: "1px solid #272A30" }} formatter={(v) => fmtKWD(v)} />
                    <Bar dataKey="amount" fill="#0066FF" radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="text-sm text-muted-foreground">No sales data for this period.</div>}
            </div>
          </div>

          {/* Job status */}
          <div className="border border-border bg-[#0F1115] rounded-sm p-6">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Job Status</div>
            <div className="grid grid-cols-2 gap-3">
              {(jobs?.by_status || []).map(j => (
                <div key={j.status} className="border border-border bg-background rounded-sm p-4">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground capitalize">{j.status.replace("_"," ")}</div>
                  <div className="font-display text-3xl font-black mt-1 font-mono-data">{j.count}</div>
                </div>
              ))}
              {(!jobs?.by_status || jobs.by_status.length === 0) && <div className="text-sm text-muted-foreground col-span-2">No jobs in range.</div>}
            </div>
          </div>

          {/* Inventory */}
          <div className="border border-border bg-[#0F1115] rounded-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Inventory Value</div>
              <Button size="sm" variant="outline" onClick={downloadInventory} className="border-border rounded-sm"><Download size={12} className="mr-1" /> CSV</Button>
            </div>
            <div className="font-display text-4xl font-black tracking-tighter font-mono-data">{inv ? fmtKWD(inv.total_stock_value) : "—"}</div>
            <div className="text-xs text-muted-foreground mt-2">{inv?.items?.length || 0} SKUs · {inv?.low_stock?.length || 0} low-stock alerts</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Kpi = ({ label, value, hint, accent }) => (
  <div className="border border-border bg-[#0F1115] rounded-sm p-5">
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    <div className="font-display text-3xl font-black tracking-tighter mt-2 font-mono-data" style={accent ? { color: accent } : {}}>{value}</div>
    {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
  </div>
);

const Row = ({ label, value, big, accent }) => (
  <div className="flex items-center justify-between">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`font-mono-data ${big ? "text-2xl font-black" : "text-sm"}`} style={accent ? { color: accent } : {}}>{value}</div>
  </div>
);
