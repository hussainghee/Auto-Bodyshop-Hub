import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtKWD, fmtDateTime, fmtDate } from "../lib/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Search, Filter, X } from "lucide-react";

const STATUS_OPTIONS = ["confirmed", "in_progress", "completed", "cancelled"];

export default function Jobs() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState({});
  const [users, setUsers] = useState([]);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    if (statusFilter !== "all") params.status = statusFilter;
    if (creatorFilter !== "all") params.creator = creatorFilter;
    if (start) params.start = start;
    if (end) params.end = end;
    const [j, c] = await Promise.all([api.get("/jobs", { params }), api.get("/customers")]);
    setList(j.data);
    setCustomers(Object.fromEntries(c.data.map(x => [x.id, x])));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, statusFilter, creatorFilter, start, end]);
  useEffect(() => {
    api.get("/users").then(r => setUsers(r.data)).catch(() => setUsers([]));
  }, []);

  const activeFiltersCount = (statusFilter !== "all" ? 1 : 0) + (creatorFilter !== "all" ? 1 : 0) + (start ? 1 : 0) + (end ? 1 : 0);

  return (
    <div data-testid="jobs-page">
      <PageHeader title={user?.role === "technician" ? "My Assigned Jobs" : "Job Cards"} subtitle="Operations" />
      <div className="p-4 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search job#, invoice#, quotation#, customer, mobile, plate…" value={q} onChange={e => setQ(e.target.value)} className="pl-9 bg-[#0F1115] border-border rounded-sm h-10" data-testid="job-search" />
          </div>
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => { setStatusFilter("all"); setCreatorFilter("all"); setStart(""); setEnd(""); }} className="border-border rounded-sm"><X size={12} className="mr-1" /> Clear filters</Button>
          )}
        </div>
        <div className="border border-border bg-[#0F1115] rounded-sm p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3"><Filter size={14} className="text-muted-foreground" /><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Filters</div></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-[10px] uppercase">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1 bg-background border-border rounded-sm h-9" data-testid="jfilter-status"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0F1115] border-border">
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase">Creator</Label>
              <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                <SelectTrigger className="mt-1 bg-background border-border rounded-sm h-9" data-testid="jfilter-creator"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0F1115] border-border max-h-[280px]">
                  <SelectItem value="all">All creators</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-[10px] uppercase">From</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} className="mt-1 bg-background border-border rounded-sm h-9" data-testid="jfilter-start" /></div>
            <div><Label className="text-[10px] uppercase">To</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="mt-1 bg-background border-border rounded-sm h-9" data-testid="jfilter-end" /></div>
          </div>
        </div>

        <div className="border border-border bg-[#0F1115] rounded-sm overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border">
                <th className="text-left px-4 sm:px-6 py-3">Number</th>
                <th className="text-left px-4 sm:px-6 py-3">Customer</th>
                <th className="text-left px-4 sm:px-6 py-3">Status</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden md:table-cell">Quotation</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden md:table-cell">Created By</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden lg:table-cell">Created</th>
                <th className="text-right px-4 sm:px-6 py-3">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map(j => {
                const c = customers[j.customer_id];
                return (
                  <tr key={j.id} className="border-b border-border/60 hover:bg-white/[0.02] cursor-pointer" onClick={() => nav(`/jobs/${j.id}`)} data-testid={`job-row-${j.id}`}>
                    <td className="px-4 sm:px-6 py-3 font-mono-data font-semibold">{j.invoice_number || j.number}</td>
                    <td className="px-4 sm:px-6 py-3">
                      <div>{c?.name || "—"}</div>
                      <div className="text-[11px] font-mono-data text-muted-foreground md:hidden">{c?.mobile || ""}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-3"><StatusBadge status={j.status} /></td>
                    <td className="px-4 sm:px-6 py-3 text-muted-foreground font-mono-data hidden md:table-cell">{j.quotation_number || "—"}</td>
                    <td className="px-4 sm:px-6 py-3 text-muted-foreground hidden md:table-cell">{j.created_by_name || "—"}</td>
                    <td className="px-4 sm:px-6 py-3 text-muted-foreground hidden lg:table-cell">{fmtDate(j.created_at) || fmtDateTime(j.created_at)}</td>
                    <td className="px-4 sm:px-6 py-3 text-right font-mono-data">{fmtKWD(j.total)}</td>
                    <td className="px-4 sm:px-6 py-3 text-right text-[#3385FF] text-xs">Open →</td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">No jobs match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
