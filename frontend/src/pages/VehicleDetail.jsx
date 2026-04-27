import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import VehicleMap from "../components/VehicleMap";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

export default function VehicleDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [v, setV] = useState(null);
  const [vt, setVt] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [panelSel, setPanelSel] = useState([]);
  const [glassSel, setGlassSel] = useState([]);
  const [areaImages, setAreaImages] = useState({});

  useEffect(() => {
    (async () => {
      const { data } = await api.get(`/vehicles/${id}`);
      setV(data);
      const types = await api.get("/vehicle-types");
      setVt(types.data.find(t => t.key === data.vehicle_type));
      const c = await api.get(`/customers/${data.customer_id}`);
      setCustomer(c.data);
    })();
  }, [id]);

  if (!v || !vt) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div data-testid="vehicle-detail-page">
      <PageHeader title={`${v.make} ${v.model}`} subtitle="Vehicle"
        actions={<>
          <Link to={customer ? `/customers/${customer.id}` : "/vehicles"}><Button variant="outline" className="border-border rounded-sm">← Back</Button></Link>
          <Button onClick={() => nav(`/quotations?customer=${v.customer_id}&vehicle=${v.id}`)} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm">New Quotation →</Button>
        </>}
      />
      <div className="p-8 space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          <Info label="Type" value={vt.label} />
          <Info label="Plate" value={v.plate || "—"} mono />
          <Info label="Year" value={v.year || "—"} />
          <Info label="VIN" value={v.vin || "—"} mono />
        </div>

        <Tabs defaultValue="panels">
          <TabsList className="bg-[#0F1115] border border-border rounded-sm h-10">
            <TabsTrigger value="panels" className="rounded-sm data-[state=active]:bg-[#0066FF] data-[state=active]:text-white" data-testid="tab-panels">Body Panels</TabsTrigger>
            <TabsTrigger value="glass" className="rounded-sm data-[state=active]:bg-[#0066FF] data-[state=active]:text-white" data-testid="tab-glass">Glass Areas</TabsTrigger>
          </TabsList>
          <TabsContent value="panels" className="mt-4">
            <VehicleMap vehicleType={vt} mode="panel" selected={panelSel} onChange={setPanelSel}
              areaImages={areaImages} onUploadImage={(id, url) => setAreaImages({...areaImages, [id]: url})} />
          </TabsContent>
          <TabsContent value="glass" className="mt-4">
            <VehicleMap vehicleType={vt} mode="glass" selected={glassSel} onChange={setGlassSel}
              areaImages={areaImages} onUploadImage={(id, url) => setAreaImages({...areaImages, [id]: url})} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const Info = ({ label, value, mono }) => (
  <div className="border border-border bg-[#0F1115] rounded-sm p-5">
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{label}</div>
    <div className={`font-display text-xl font-bold ${mono ? "font-mono-data" : ""}`}>{value}</div>
  </div>
);
