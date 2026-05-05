import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtKWD, fmtDateTime } from "../lib/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TrendingUp, Wrench, Clock, AlertTriangle, ArrowUpRight } from "lucide-react";

const MetricCard = ({ label, value, hint, icon: Icon, accent = "#0066FF", testid }) => (
  <div className="border border-border bg-[#0F1115] p-4 sm:p-6 rounded-sm transition hover:border-[#0066FF]/50" data-testid={testid}>
    <div className="flex items-start justify-between">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <Icon size={16} style={{ color: accent }} />
    </div>
    <div className="font-display text-2xl sm:text-4xl font-black tracking-tighter mt-2 sm:mt-3 font-mono-data break-words">{value}</div>
    {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [pending, setPending] = useState([]);

  useEffect(() => {
    (async () => {
      const [d, all] = await Promise.all([
        api.get("/reports/dashboard"),
        api.get("/jobs"),
      ]);
      setData(d.data);
      setPending(all.data.filter(j => ["confirmed","in_progress"].includes(j.status)).slice(0, 6));
    })();
  }, []);

  return (
    <div data-testid="dashboard-page">
      <PageHeader title="Dashboard" subtitle="Overview" />
      <div className="p-4 sm:p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard label="Today's Jobs" value={data?.todays_jobs ?? "—"} icon={Wrench} testid="metric-todays-jobs" />
          <MetricCard label="Revenue Today" value={data ? fmtKWD(data.revenue_today) : "—"} icon={TrendingUp} accent="#00FF66" testid="metric-revenue" />
          <MetricCard label="Pending Jobs" value={data?.pending_jobs ?? "—"} icon={Clock} accent="#FFCC00" testid="metric-pending" />
          <MetricCard label="Customers" value={data?.customers_count ?? "—"} icon={ArrowUpRight} testid="metric-customers" />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 border border-border bg-[#0F1115] rounded-sm">
            <div className="px-6 py-4 border-b border-border">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Revenue (7 days)</div>
              <div className="font-display text-xl font-bold mt-1">Performance</div>
            </div>
            <div className="p-4 h-72">
              {data && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.revenue_series}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0066FF" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#0066FF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1A1D24" vertical={false} />
                    <XAxis dataKey="date" stroke="#A1A1AA" fontSize={11} tickFormatter={(d) => d.slice(5)} />
                    <YAxis stroke="#A1A1AA" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#0F1115", border: "1px solid #272A30" }} formatter={(v) => fmtKWD(v)} />
                    <Area type="monotone" dataKey="revenue" stroke="#0066FF" strokeWidth={2} fill="url(#g1)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="border border-border bg-[#0F1115] rounded-sm flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <AlertTriangle size={16} className="text-[#FFCC00]" />
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Low Stock</div>
            </div>
            <div className="divide-y divide-border flex-1 overflow-y-auto" data-testid="low-stock-list">
              {(data?.low_stock || []).length === 0 && <div className="p-6 text-sm text-muted-foreground">All stock healthy ✓</div>}
              {(data?.low_stock || []).map(it => (
                <div key={it.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{it.name}</div>
                    <div className="text-[11px] text-muted-foreground">{it.sku}</div>
                  </div>
                  <div className="font-mono-data text-sm text-[#FFCC00]">{it.stock_qty} {it.unit}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border border-border bg-[#0F1115] rounded-sm overflow-x-auto">
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Active & Pending Jobs</div>
          </div>
          <table className="w-full text-sm min-w-[480px]">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3">Job #</th>
                <th className="text-left px-6 py-3">Created</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-right px-6 py-3">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No pending jobs</td></tr>}
              {pending.map(j => (
                <tr key={j.id} className="border-b border-border/60 hover:bg-white/[0.02]">
                  <td className="px-6 py-3 font-mono-data font-semibold">{j.number}</td>
                  <td className="px-6 py-3 text-muted-foreground">{fmtDateTime(j.created_at)}</td>
                  <td className="px-6 py-3"><StatusBadge status={j.status} /></td>
                  <td className="px-6 py-3 text-right font-mono-data">{fmtKWD(j.total)}</td>
                  <td className="px-6 py-3 text-right">
                    <Link to={`/jobs/${j.id}`} className="text-[#3385FF] text-xs hover:underline">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
