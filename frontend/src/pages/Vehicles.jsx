import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDate } from "../lib/api";
import PageHeader from "../components/PageHeader";

export default function Vehicles() {
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState({});

  useEffect(() => {
    (async () => {
      const [v, c] = await Promise.all([api.get("/vehicles"), api.get("/customers")]);
      setList(v.data);
      setCustomers(Object.fromEntries(c.data.map(x => [x.id, x.name])));
    })();
  }, []);

  return (
    <div data-testid="vehicles-page">
      <PageHeader title="Vehicles" subtitle="Fleet" />
      <div className="p-8">
        <div className="border border-border bg-[#0F1115] rounded-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3">Vehicle</th>
                <th className="text-left px-6 py-3">Type</th>
                <th className="text-left px-6 py-3">Owner</th>
                <th className="text-left px-6 py-3">Plate</th>
                <th className="text-left px-6 py-3">Year</th>
                <th className="text-left px-6 py-3">Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map(v => (
                <tr key={v.id} className="border-b border-border/60 hover:bg-white/[0.02]">
                  <td className="px-6 py-3 font-semibold">{v.make} {v.model}</td>
                  <td className="px-6 py-3 capitalize">{v.vehicle_type}</td>
                  <td className="px-6 py-3 text-muted-foreground">{customers[v.customer_id] || "—"}</td>
                  <td className="px-6 py-3 font-mono-data">{v.plate || "—"}</td>
                  <td className="px-6 py-3">{v.year || "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground">{fmtDate(v.created_at)}</td>
                  <td className="px-6 py-3 text-right"><Link to={`/vehicles/${v.id}`} className="text-[#3385FF] text-xs hover:underline">Open →</Link></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No vehicles yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
