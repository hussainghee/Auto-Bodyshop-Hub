import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fmtDate, waLink, API } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ArrowLeft, Download, MessageCircle, Search, Users } from "lucide-react";
import { toast } from "sonner";

export default function SegmentDetail() {
  const { id } = useParams();
  const [seg, setSeg] = useState(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (search = "") => {
    setLoading(true);
    try {
      const { data } = await api.get(`/segments/${id}`, { params: search ? { q: search } : {} });
      setSeg(data);
    } catch { toast.error("Segment not found"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(""); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  const exportSeg = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API}/segments/${id}/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `segment_${(seg?.name || "segment").replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().slice(0,10)}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported");
    } catch { toast.error("Export failed"); }
  };

  const filterChips = useMemo(() => {
    if (!seg?.filters) return [];
    return Object.entries(seg.filters).filter(([, v]) =>
      v !== null && v !== "" && v !== undefined && !(Array.isArray(v) && v.length === 0)
    );
  }, [seg]);

  if (loading && !seg) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!seg) return <div className="p-8 text-muted-foreground">Segment not found.</div>;

  return (
    <div data-testid="segment-detail">
      <PageHeader title={seg.name} subtitle="Segment Detail"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/customers/segments" className="text-xs text-[#3385FF] hover:underline flex items-center gap-1" data-testid="back-to-segments"><ArrowLeft size={12} /> Back</Link>
            <Button variant="outline" onClick={exportSeg} className="border-border rounded-sm" data-testid="export-segment-btn"><Download size={14} className="mr-1.5" /> Export Excel</Button>
          </div>
        }
      />
      <div className="p-4 sm:p-8 space-y-6">
        <div className="border border-border bg-[#0F1115] rounded-sm p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-3">
            {seg.description && <div className="text-sm text-muted-foreground">{seg.description}</div>}
            <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
              <span>Created {seg.created_at ? fmtDate(seg.created_at) : "—"}</span>
              {seg.created_by_name && <span>By {seg.created_by_name}</span>}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Filter Criteria</div>
              <div className="flex flex-wrap gap-1.5">
                {filterChips.length === 0 && <span className="text-xs text-muted-foreground">No filters (all customers)</span>}
                {filterChips.map(([k, v]) => (
                  <span key={k} className="text-[11px] border border-[#0066FF]/40 bg-[#0066FF]/10 text-[#3385FF] rounded-sm px-2 py-0.5 font-mono-data" data-testid={`chip-${k}`}>
                    {k}: {Array.isArray(v) ? v.join(" · ") : String(v)}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="border-l border-border pl-6 hidden md:flex flex-col items-start justify-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Users size={12} /> Customers in Segment</div>
            <div className="font-display text-5xl font-black mt-2 font-mono-data" data-testid="segment-count">{seg.customer_count ?? 0}</div>
          </div>
          <div className="md:hidden flex items-center gap-2 text-sm">
            <Users size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground">Customers:</span>
            <span className="font-display font-black text-2xl font-mono-data">{seg.customer_count ?? 0}</span>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or mobile…" value={q} onChange={e => setQ(e.target.value)}
            className="pl-9 bg-[#0F1115] border-border rounded-sm h-10" data-testid="segment-customer-search" />
        </div>

        {/* Desktop table */}
        <div className="hidden md:block border border-border bg-[#0F1115] rounded-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3">Name</th>
                <th className="text-left px-6 py-3">Mobile</th>
                <th className="text-left px-6 py-3">Email</th>
                <th className="text-left px-6 py-3">Vehicle(s)</th>
                <th className="text-left px-6 py-3">Registered</th>
                <th />
              </tr>
            </thead>
            <tbody data-testid="segment-customers-table">
              {(seg.customers || []).map(c => (
                <tr key={c.id} className="border-b border-border/60 hover:bg-white/[0.02]">
                  <td className="px-6 py-3 font-semibold">{c.name}</td>
                  <td className="px-6 py-3 font-mono-data">
                    <div className="flex items-center gap-2">
                      {c.mobile}
                      <a href={waLink(c.mobile)} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300"><MessageCircle size={14} /></a>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{c.email || "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {(c.vehicles || []).slice(0, 2).map((v, i) => (
                      <span key={i} className="inline-block mr-2">{v.make} {v.model}{v.year ? ` (${v.year})` : ""}</span>
                    ))}
                    {(c.vehicles || []).length > 2 && <span className="text-[11px]">+{c.vehicles.length - 2}</span>}
                    {(c.vehicles || []).length === 0 && "—"}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{c.created_at ? fmtDate(c.created_at) : "—"}</td>
                  <td className="px-6 py-3 text-right"><Link to={`/customers/${c.id}`} className="text-[#3385FF] text-xs hover:underline">Open →</Link></td>
                </tr>
              ))}
              {(seg.customers || []).length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No customers match.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden space-y-2" data-testid="segment-customers-cards">
          {(seg.customers || []).map(c => (
            <Link key={c.id} to={`/customers/${c.id}`} className="block border border-border bg-[#0F1115] rounded-sm p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs font-mono-data text-muted-foreground mt-0.5">{c.mobile}</div>
                  {c.email && <div className="text-xs text-muted-foreground truncate">{c.email}</div>}
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {(c.vehicles || []).slice(0, 2).map(v => `${v.make} ${v.model}${v.year ? ` (${v.year})` : ""}`).join(" · ") || "No vehicles"}
                  </div>
                </div>
                <a href={waLink(c.mobile)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-emerald-400 hover:text-emerald-300 p-1"><MessageCircle size={16} /></a>
              </div>
              <div className="text-[11px] text-muted-foreground mt-2">Registered {c.created_at ? fmtDate(c.created_at) : "—"}</div>
            </Link>
          ))}
          {(seg.customers || []).length === 0 && <div className="text-center text-muted-foreground py-8">No customers match.</div>}
        </div>
      </div>
    </div>
  );
}
