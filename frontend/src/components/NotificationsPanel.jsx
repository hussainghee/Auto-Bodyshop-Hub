import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtKWD } from "../lib/api";
import { Bell, AlertTriangle, Clock, Send, Hourglass, CreditCard } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export default function NotificationsPanel() {
  const [data, setData] = useState({ count: 0 });
  const [open, setOpen] = useState(false);

  const load = () => api.get("/notifications").then(r => setData(r.data)).catch(() => {});
  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 hover:bg-white/[0.05] rounded-sm border border-border" data-testid="notifications-bell">
          <Bell size={16} />
          {data.count > 0 && <span className="absolute -top-1 -right-1 bg-[#FF3B30] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{data.count > 9 ? "9+" : data.count}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 bg-[#0F1115] border-border rounded-sm p-0 max-h-[500px] overflow-y-auto" data-testid="notifications-panel">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Notifications</div>
          <div className="font-display text-lg font-bold mt-1">{data.count} alerts</div>
        </div>

        <Section title="Outstanding Payments" count={data.outstanding_jobs?.length || 0} icon={CreditCard} accent="#FFCC00">
          {data.outstanding_jobs?.slice(0, 5).map(j => (
            <Row key={j.id} to={`/jobs/${j.id}`} onClose={() => setOpen(false)}
              primary={j.invoice_number || j.number} secondary={fmtKWD(j.balance) + " due"} />
          ))}
          {data.total_outstanding > 0 && <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">Total A/R: <span className="text-white font-semibold font-mono-data">{fmtKWD(data.total_outstanding)}</span></div>}
        </Section>

        <Section title="Low Stock" count={data.low_stock?.length || 0} icon={AlertTriangle} accent="#FFCC00">
          {data.low_stock?.slice(0, 5).map(it => (
            <Row key={it.id} to="/inventory" onClose={() => setOpen(false)} primary={it.name} secondary={`${it.stock_qty} ${it.unit}`} />
          ))}
        </Section>

        <Section title="Overdue Jobs" count={data.overdue_jobs?.length || 0} icon={Clock} accent="#FF3B30">
          {data.overdue_jobs?.slice(0, 5).map(j => (
            <Row key={j.id} to={`/jobs/${j.id}`} onClose={() => setOpen(false)} primary={j.number} secondary={j.status} />
          ))}
        </Section>

        <Section title="Pending Quotations" count={data.pending_quotations?.length || 0} icon={Send} accent="#3385FF">
          {data.pending_quotations?.slice(0, 5).map(q => (
            <Row key={q.id} to={`/quotations/${q.id}`} onClose={() => setOpen(false)} primary={q.number} secondary={fmtKWD(q.total)} />
          ))}
        </Section>

        <Section title="Expired Quotations" count={data.expired_quotations?.length || 0} icon={Hourglass} accent="#FF3B30">
          {data.expired_quotations?.slice(0, 5).map(q => (
            <Row key={q.id} to={`/quotations/${q.id}`} onClose={() => setOpen(false)} primary={q.number} secondary={fmtKWD(q.total)} />
          ))}
        </Section>

        {data.count === 0 && <div className="p-8 text-center text-sm text-muted-foreground">All clear ✓</div>}
      </PopoverContent>
    </Popover>
  );
}

const Section = ({ title, count, icon: Icon, accent, children }) => {
  if (!count) return null;
  return (
    <div className="border-b border-border">
      <div className="px-4 py-2 flex items-center gap-2 bg-[#0a0b0e]">
        <Icon size={12} style={{ color: accent }} />
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex-1">{title}</div>
        <div className="text-xs font-mono-data" style={{ color: accent }}>{count}</div>
      </div>
      {children}
    </div>
  );
};

const Row = ({ to, primary, secondary, onClose }) => (
  <Link to={to} onClick={onClose} className="block px-4 py-2.5 hover:bg-white/[0.03] border-b border-border/30 last:border-0">
    <div className="flex items-center justify-between">
      <div className="text-sm font-semibold truncate">{primary}</div>
      <div className="text-xs text-muted-foreground font-mono-data">{secondary}</div>
    </div>
  </Link>
);
