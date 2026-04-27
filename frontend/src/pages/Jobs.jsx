import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtKWD, fmtDateTime } from "../lib/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";

const STATUS_FILTERS = ["all", "confirmed", "in_progress", "completed", "cancelled"];

export default function Jobs() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("all");
  const [customers, setCustomers] = useState({});

  const load = async () => {
    const params = filter !== "all" ? { status: filter } : {};
    const [j, c] = await Promise.all([api.get("/jobs", { params }), api.get("/customers")]);
    setList(j.data);
    setCustomers(Object.fromEntries(c.data.map(x => [x.id, x.name])));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  return (
    <div data-testid="jobs-page">
      <PageHeader title={user?.role === "technician" ? "My Assigned Jobs" : "Job Cards"} subtitle="Operations" />
      <div className="p-8">
        <div className="flex gap-2 mb-4">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 border text-xs uppercase tracking-wider rounded-sm ${filter === s ? "bg-[#0066FF] border-[#0066FF] text-white" : "border-border text-muted-foreground hover:text-white"}`} data-testid={`filter-${s}`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="border border-border bg-[#0F1115] rounded-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border"><th className="text-left px-6 py-3">Number</th><th className="text-left px-6 py-3">Customer</th><th className="text-left px-6 py-3">Status</th><th className="text-left px-6 py-3">Created</th><th className="text-right px-6 py-3">Total</th><th /></tr>
            </thead>
            <tbody>
              {list.map(j => (
                <tr key={j.id} className="border-b border-border/60 hover:bg-white/[0.02]">
                  <td className="px-6 py-3 font-mono-data font-semibold">{j.number}</td>
                  <td className="px-6 py-3">{customers[j.customer_id] || "—"}</td>
                  <td className="px-6 py-3"><StatusBadge status={j.status} /></td>
                  <td className="px-6 py-3 text-muted-foreground">{fmtDateTime(j.created_at)}</td>
                  <td className="px-6 py-3 text-right font-mono-data">{fmtKWD(j.total)}</td>
                  <td className="px-6 py-3 text-right"><Link to={`/jobs/${j.id}`} className="text-[#3385FF] text-xs hover:underline">Open →</Link></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No jobs.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
