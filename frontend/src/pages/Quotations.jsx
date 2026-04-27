import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, fmtKWD, fmtDate } from "../lib/api";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import VehicleMap from "../components/VehicleMap";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, Trash2, ChevronRight, ChevronLeft, Hourglass } from "lucide-react";
import { toast } from "sonner";

const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;

const AREA_SERVICE_MODES = ["per_panel", "per_glass_area"];

export default function Quotations() {
  const [params] = useSearchParams();
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [services, setServices] = useState([]);
  const [vts, setVts] = useState([]);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const [customerId, setCustomerId] = useState(params.get("customer") || "");
  const [vehicleId, setVehicleId] = useState(params.get("vehicle") || "");
  const [selectedServices, setSelectedServices] = useState([]);  // [{service, mode: 'panel'|'glass'|null}]
  const [panelSel, setPanelSel] = useState([]);
  const [glassSel, setGlassSel] = useState([]);
  const [areaImages, setAreaImages] = useState({});
  const [lines, setLines] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");

  const loadList = async () => setList((await api.get("/quotations")).data);

  useEffect(() => { loadList(); }, []);
  useEffect(() => {
    (async () => {
      const [c, s, t] = await Promise.all([api.get("/customers"), api.get("/services"), api.get("/vehicle-types")]);
      setCustomers(c.data); setServices(s.data); setVts(t.data);
    })();
  }, []);
  useEffect(() => {
    if (customerId) api.get("/vehicles", { params: { customer_id: customerId } }).then(r => setVehicles(r.data));
    else setVehicles([]);
  }, [customerId]);

  const vehicle = vehicles.find(v => v.id === vehicleId);
  const vt = vts.find(t => t.key === vehicle?.vehicle_type);

  const needsPanel = selectedServices.some(s => s.pricing_mode === "per_panel");
  const needsGlass = selectedServices.some(s => s.pricing_mode === "per_glass_area");
  const needsAreas = needsPanel || needsGlass;

  const steps = useMemo(() => {
    return needsAreas
      ? ["Customer & Vehicle", "Services", "Areas", "Review"]
      : ["Customer & Vehicle", "Services", "Review"];
  }, [needsAreas]);

  const reset = () => {
    setStep(0); setCustomerId(""); setVehicleId(""); setPanelSel([]); setGlassSel([]);
    setSelectedServices([]); setLines([]); setDiscount(0); setTaxRate(0); setNotes("");
    setAreaImages({}); setValidUntil("");
  };

  const toggleService = (svc) => {
    if (selectedServices.find(s => s.id === svc.id)) {
      setSelectedServices(selectedServices.filter(s => s.id !== svc.id));
    } else {
      setSelectedServices([...selectedServices, svc]);
    }
  };

  // When moving to Review, compute lines based on current selection
  const computeLinesFor = (vtKey, panels, glass) => {
    return selectedServices.map(svc => {
      let qty = 1, unit = 0, areas = [];
      switch (svc.pricing_mode) {
        case "fixed": unit = svc.fixed_price || 0; break;
        case "per_vehicle_type": unit = svc.vehicle_type_prices?.[vtKey] || 0; break;
        case "full_vehicle": unit = svc.full_vehicle_prices?.[vtKey] || 0; break;
        case "per_panel": {
          const map = svc.panel_prices?.[vtKey] || {};
          unit = panels.reduce((sum, id) => sum + (map[id] || 0), 0);
          areas = panels; break;
        }
        case "per_glass_area": {
          const map = svc.glass_prices?.[vtKey] || {};
          unit = glass.reduce((sum, id) => sum + (map[id] || 0), 0);
          areas = glass; break;
        }
        default: break;
      }
      return {
        service_id: svc.id, service_name: svc.name, description: svc.description,
        quantity: qty, unit_price: round3(unit), line_total: round3(qty * unit),
        selected_areas: areas,
      };
    });
  };

  const goNext = () => {
    if (step === 0 && (!customerId || !vehicleId)) { toast.error("Pick customer & vehicle"); return; }
    if (step === 1 && selectedServices.length === 0) { toast.error("Pick at least one service"); return; }
    // when leaving services (or areas), compute lines
    const isGoingToReview = (needsAreas && step === 2) || (!needsAreas && step === 1);
    if (isGoingToReview) {
      const computed = computeLinesFor(vehicle?.vehicle_type, panelSel, glassSel);
      const bad = computed.find(l => l.unit_price <= 0);
      if (bad) { toast.error(`No price defined for "${bad.service_name}" on this vehicle type / selection`); return; }
      setLines(computed);
    }
    setStep(step + 1);
  };

  const updateLine = (idx, patch) => {
    const next = lines.map((l, i) => i === idx ? { ...l, ...patch, line_total: round3((patch.quantity ?? l.quantity) * (patch.unit_price ?? l.unit_price)) } : l);
    setLines(next);
  };

  const subtotal = useMemo(() => round3(lines.reduce((s, l) => s + l.line_total, 0)), [lines]);
  const taxAmount = round3(Math.max(subtotal - discount, 0) * (taxRate / 100));
  const total = round3(Math.max(subtotal - discount, 0) + taxAmount);

  const submit = async () => {
    try {
      const payload = {
        customer_id: customerId, vehicle_id: vehicleId,
        lines, discount: Number(discount), tax_rate: Number(taxRate), notes,
        valid_until: validUntil || null,
      };
      await api.post("/quotations", payload);
      toast.success("Quotation created");
      setOpen(false); reset(); loadList();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const lastIdx = steps.length - 1;
  const reviewIdx = lastIdx;
  const servicesIdx = 1;
  const areasIdx = needsAreas ? 2 : null;

  const selectAllPanels = () => setPanelSel((vt?.panels || []).map(p => p.id));
  const selectAllGlass = () => setGlassSel((vt?.glass_areas || []).map(g => g.id));

  return (
    <div data-testid="quotations-page">
      <PageHeader title="Quotations" subtitle="Sales"
        actions={<Button onClick={() => { reset(); setOpen(true); }} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="new-quotation-btn"><Plus size={16} className="mr-1.5" /> New Quotation</Button>}
      />
      <div className="p-8">
        <div className="border border-border bg-[#0F1115] rounded-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border"><th className="text-left px-6 py-3">Number</th><th className="text-left px-6 py-3">Customer</th><th className="text-left px-6 py-3">Status</th><th className="text-left px-6 py-3">Date</th><th className="text-left px-6 py-3">Valid Until</th><th className="text-right px-6 py-3">Total</th><th /></tr>
            </thead>
            <tbody>
              {list.map(q => {
                const cust = customers.find(c => c.id === q.customer_id);
                return (
                  <tr key={q.id} className="border-b border-border/60 hover:bg-white/[0.02]">
                    <td className="px-6 py-3 font-mono-data font-semibold">{q.number}</td>
                    <td className="px-6 py-3">{cust?.name || "—"}</td>
                    <td className="px-6 py-3 flex items-center gap-2">
                      <StatusBadge status={q.status} />
                      {q.is_expired && <span className="tag-status" style={{ color: "#FF3B30", background: "rgba(255,59,48,0.08)", borderColor: "#FF3B30" }}><Hourglass size={10} className="inline mr-1" />EXPIRED</span>}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{fmtDate(q.created_at)}</td>
                    <td className="px-6 py-3 text-muted-foreground">{fmtDate(q.valid_until)}</td>
                    <td className="px-6 py-3 text-right font-mono-data">{fmtKWD(q.total)}</td>
                    <td className="px-6 py-3 text-right"><Link to={`/quotations/${q.id}`} className="text-[#3385FF] text-xs hover:underline">Open →</Link></td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No quotations yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-black tracking-tighter">New Quotation</DialogTitle>
            <div className="flex items-center gap-2 mt-3">
              {steps.map((s, i) => (
                <div key={i} className={`flex-1 px-3 py-2 border rounded-sm text-xs uppercase tracking-wider ${i === step ? "bg-[#0066FF] border-[#0066FF] text-white" : i < step ? "border-[#0066FF]/40 text-[#3385FF]" : "border-border text-muted-foreground"}`}>
                  {i + 1}. {s}
                </div>
              ))}
            </div>
          </DialogHeader>

          <div className="mt-4 min-h-[400px]" data-testid="quotation-wizard">
            {step === 0 && (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider">Customer *</Label>
                  <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setVehicleId(""); }}>
                    <SelectTrigger className="mt-1 bg-background border-border rounded-sm h-11" data-testid="wizard-customer-select"><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent className="bg-[#0F1115] border-border">
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.mobile}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider">Vehicle *</Label>
                  <Select value={vehicleId} onValueChange={setVehicleId} disabled={!customerId}>
                    <SelectTrigger className="mt-1 bg-background border-border rounded-sm h-11" data-testid="wizard-vehicle-select"><SelectValue placeholder={customerId ? "Select vehicle" : "Pick customer first"} /></SelectTrigger>
                    <SelectContent className="bg-[#0F1115] border-border">
                      {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.vehicle_type}) — {v.plate || "no plate"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {step === servicesIdx && (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">Pick the services to include in this quotation. Panel / glass selection (next step) is only required if needed by the selected services.</div>
                <div className="border border-border rounded-sm divide-y divide-border max-h-[460px] overflow-y-auto">
                  {services.filter(s => s.active !== false).map(s => {
                    const sel = !!selectedServices.find(x => x.id === s.id);
                    const needsArea = AREA_SERVICE_MODES.includes(s.pricing_mode);
                    return (
                      <button key={s.id} type="button" onClick={() => toggleService(s)}
                        className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] ${sel ? "bg-[#0066FF]/5" : ""}`}
                        data-testid={`toggle-service-${s.id}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-5 h-5 border rounded-sm flex items-center justify-center text-[10px] font-bold ${sel ? "bg-[#0066FF] border-[#0066FF] text-white" : "border-border"}`}>{sel ? "✓" : ""}</div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold flex items-center gap-2">
                              {s.name}
                              {s.is_bundle && <span className="tag-status" style={{ color: "#FFCC00", background: "rgba(255,204,0,0.08)", borderColor: "#FFCC00" }}>BUNDLE</span>}
                              {needsArea && <span className="text-[10px] uppercase tracking-widest text-muted-foreground">needs area</span>}
                            </div>
                            <div className="text-[11px] text-muted-foreground capitalize">{s.category.replace(/_/g, " ")} · {s.pricing_mode.replace(/_/g, " ")}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === areasIdx && vt && (
              <div className="space-y-6">
                <div className="text-sm text-muted-foreground">Select areas for the chosen services. Each selection automatically contributes to pricing.</div>
                {needsPanel && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Body Panels</div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={selectAllPanels} className="bg-[#0066FF]/10 hover:bg-[#0066FF] text-[#3385FF] hover:text-white border border-[#0066FF]/40 rounded-sm" data-testid="select-all-panels">All</Button>
                        <Button type="button" size="sm" onClick={() => setPanelSel([])} variant="outline" className="border-border rounded-sm">Clear</Button>
                      </div>
                    </div>
                    <VehicleMap vehicleType={vt} mode="panel" selected={panelSel} onChange={setPanelSel} areaImages={areaImages} onUploadImage={(id, url) => setAreaImages({...areaImages, [id]: url})} />
                  </div>
                )}
                {needsGlass && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Glass Areas</div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={selectAllGlass} className="bg-[#0066FF]/10 hover:bg-[#0066FF] text-[#3385FF] hover:text-white border border-[#0066FF]/40 rounded-sm" data-testid="select-all-glass">All</Button>
                        <Button type="button" size="sm" onClick={() => setGlassSel([])} variant="outline" className="border-border rounded-sm">Clear</Button>
                      </div>
                    </div>
                    <VehicleMap vehicleType={vt} mode="glass" selected={glassSel} onChange={setGlassSel} areaImages={areaImages} onUploadImage={(id, url) => setAreaImages({...areaImages, [id]: url})} />
                  </div>
                )}
              </div>
            )}

            {step === reviewIdx && (
              <div className="space-y-4">
                <div className="border border-border rounded-sm">
                  <table className="w-full text-sm">
                    <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]"><tr className="border-b border-border"><th className="text-left px-4 py-2">Service</th><th className="text-right px-4 py-2">Qty</th><th className="text-right px-4 py-2">Unit</th><th className="text-right px-4 py-2">Total</th><th /></tr></thead>
                    <tbody>
                      {lines.map((l, i) => (
                        <tr key={i} className="border-b border-border/60">
                          <td className="px-4 py-2"><div className="font-semibold">{l.service_name}</div>{l.selected_areas?.length > 0 && <div className="text-[11px] text-muted-foreground">{l.selected_areas.length} areas</div>}</td>
                          <td className="px-4 py-2 text-right"><Input type="number" step="0.01" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} className="w-20 bg-background border-border rounded-sm h-8 text-sm text-right" /></td>
                          <td className="px-4 py-2 text-right"><Input type="number" step="0.001" value={l.unit_price} onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })} className="w-24 bg-background border-border rounded-sm h-8 text-sm text-right" /></td>
                          <td className="px-4 py-2 text-right font-mono-data font-semibold">{fmtKWD(l.line_total)}</td>
                          <td className="px-4 py-2 text-right"><button onClick={() => setLines(lines.filter((_, x) => x !== i))} className="text-muted-foreground hover:text-[#FF3B30]"><Trash2 size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div><Label className="text-[10px] uppercase tracking-wider">Discount (KWD)</Label><Input type="number" step="0.001" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="mt-1 bg-background border-border rounded-sm" data-testid="quotation-discount" /></div>
                  <div><Label className="text-[10px] uppercase tracking-wider">Tax Rate (%)</Label><Input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="mt-1 bg-background border-border rounded-sm" /></div>
                  <div><Label className="text-[10px] uppercase tracking-wider">Valid Until</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="mt-1 bg-background border-border rounded-sm" data-testid="quotation-valid-until" /></div>
                </div>
                <div><Label className="text-[10px] uppercase tracking-wider">Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 bg-background border-border rounded-sm" /></div>
                <div className="border border-border rounded-sm p-4 ml-auto md:w-80">
                  <Row label="Subtotal" value={fmtKWD(subtotal)} />
                  <Row label="Discount" value={`- ${fmtKWD(discount)}`} />
                  <Row label={`Tax (${taxRate}%)`} value={fmtKWD(taxAmount)} />
                  <div className="border-t border-border mt-2 pt-2"><Row label="Total" value={fmtKWD(total)} big /></div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-4 flex !justify-between">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)} className="border-border rounded-sm" data-testid="wizard-back"><ChevronLeft size={16} /> Back</Button>
            {step < reviewIdx ? (
              <Button onClick={goNext} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="wizard-next">Next <ChevronRight size={16} /></Button>
            ) : (
              <Button onClick={submit} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="wizard-submit">Create Quotation</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Row = ({ label, value, big }) => (
  <div className="flex items-center justify-between py-1">
    <div className={`${big ? "text-sm uppercase tracking-widest text-muted-foreground font-semibold" : "text-xs text-muted-foreground"}`}>{label}</div>
    <div className={`font-mono-data ${big ? "text-2xl font-black" : "text-sm"}`}>{value}</div>
  </div>
);
