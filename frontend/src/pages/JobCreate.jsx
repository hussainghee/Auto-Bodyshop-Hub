import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, fmtKWD } from "../lib/api";
import PageHeader from "../components/PageHeader";
import VehicleMap from "../components/VehicleMap";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, Trash2, ChevronRight, ChevronLeft, Hourglass, Search } from "lucide-react";
import { toast } from "sonner";

const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const AREA_SERVICE_MODES = ["per_panel", "per_glass_area"];
export default function JobCreate() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [services, setServices] = useState([]);
  const [vts, setVts] = useState([]);

  // Wizard state
  const [step, setStep] = useState(0);
  const [customerSearch, setCustomerSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  // Quick-add customer state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [qaName, setQaName] = useState("");
  const [qaMobile, setQaMobile] = useState("");
  const [qaSaving, setQaSaving] = useState(false);
  const [customerId, setCustomerId] = useState(params.get("customer") || "");
  const [vehicleId, setVehicleId] = useState(params.get("vehicle") || "");
  const [selectedServices, setSelectedServices] = useState([]);
  const [panelSel, setPanelSel] = useState([]);
  const [glassSel, setGlassSel] = useState([]);
  const [areaImages, setAreaImages] = useState({});
  const [lines, setLines] = useState([]);
  const [discountType, setDiscountType] = useState("amount");
  const [discountValue, setDiscountValue] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      const [c, svc, t] = await Promise.all([
        api.get("/customers"),
        api.get("/services"),
        api.get("/vehicle-types"),
      ]);
      setCustomers(c.data);
      setServices(svc.data);
      setVts(t.data);
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

  const steps = useMemo(() => needsAreas
    ? ["Customer", "Services", "Areas", "Review"]
    : ["Customer", "Services", "Review"], [needsAreas]);

  const reset = () => {
    setStep(0); setCustomerId(""); setVehicleId(""); setPanelSel([]); setGlassSel([]);
    setSelectedServices([]); setLines([]); setDiscountType("amount"); setDiscountValue(0);
    setTaxRate(0); setNotes(""); setAreaImages({});
    setCustomerSearch(""); setServiceSearch("");
    setQuickAddOpen(false); setQaName(""); setQaMobile("");
  };

  const quickAddCustomer = async () => {
    const name = qaName.trim();
    const mobile = qaMobile.trim();
    if (!name || !mobile) { toast.error("Name and mobile required"); return; }
    setQaSaving(true);
    try {
      const { data } = await api.post("/customers", { name, mobile, vehicles: [] });
      const fresh = (await api.get("/customers")).data;
      setCustomers(fresh);
      setCustomerId(data.id);
      setVehicleId("");
      setQuickAddOpen(false); setQaName(""); setQaMobile(""); setCustomerSearch("");
      toast.success(`Added ${data.name}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to add customer");
    } finally { setQaSaving(false); }
  };

  const filteredCustomers = useMemo(() => {
    const s = customerSearch.toLowerCase().trim();
    if (!s) return customers;
    return customers.filter(c =>
      (c.name || "").toLowerCase().includes(s) ||
      (c.mobile || "").toLowerCase().includes(s)
    );
  }, [customers, customerSearch]);

  const filteredServices = useMemo(() => {
    const s = serviceSearch.toLowerCase().trim();
    const active = services.filter(x => x.active !== false);
    if (!s) return active;
    return active.filter(svc =>
      (svc.name || "").toLowerCase().includes(s) ||
      (svc.category || "").toLowerCase().includes(s) ||
      (svc.pricing_mode || "").toLowerCase().includes(s)
    );
  }, [services, serviceSearch]);

  const toggleService = (svc) => {
    if (selectedServices.find(s => s.id === svc.id)) {
      setSelectedServices(selectedServices.filter(s => s.id !== svc.id));
    } else {
      setSelectedServices([...selectedServices, svc]);
    }
  };

  const computeLinesFor = (vtKey, panels, glass) => selectedServices.map(svc => {
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

  const goNext = () => {
    if (step === 0 && (!customerId || !vehicleId)) { toast.error("Pick customer & vehicle"); return; }
    if (step === 1 && selectedServices.length === 0) { toast.error("Pick at least one service"); return; }
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
  const discountAmount = useMemo(() => {
    const v = Number(discountValue) || 0;
    return discountType === "percent" ? round3(subtotal * Math.max(v, 0) / 100) : round3(Math.max(v, 0));
  }, [subtotal, discountType, discountValue]);
  const taxAmount = round3(Math.max(subtotal - discountAmount, 0) * (taxRate / 100));
  const total = round3(Math.max(subtotal - discountAmount, 0) + taxAmount);
  const showDiscountLine = discountAmount > 0;

  const submit = async () => {
    try {
      const payload = {
        customer_id: customerId, vehicle_id: vehicleId,
        lines,
        discount: discountAmount,
        discount_type: discountType,
        discount_value: Number(discountValue) || 0,
        tax_rate: Number(taxRate),
        notes,
        technician_id: null,
      };
      const { data } = await api.post("/jobs", payload);
      toast.success(`Job Card ${data.number} created`);
      reset();
      nav(`/jobs/${data.id}`);
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const reviewIdx = steps.length - 1;
  const servicesIdx = 1;
  const areasIdx = needsAreas ? 2 : null;

  const selectAllPanels = () => setPanelSel((vt?.panels || []).map(p => p.id));
  const selectAllGlass = () => setGlassSel((vt?.glass_areas || []).map(g => g.id));
  const selectFullVehicle = () => {
    if (vt?.panels?.length) setPanelSel(vt.panels.map(p => p.id));
    if (vt?.glass_areas?.length) setGlassSel(vt.glass_areas.map(g => g.id));
  };


  return (
    <div data-testid="job-create-page">
      <PageHeader
        title="New Job Card"
        subtitle="Operations"
        actions={
          <Button variant="outline" onClick={() => nav("/jobs")} className="border-border rounded-sm">
            Back to Job Cards
          </Button>
        }
      />

      <Dialog open={true} onOpenChange={(v) => { if (!v) nav("/jobs"); }}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-[1100px] w-[calc(100vw-1.5rem)] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-black tracking-tighter">New Job Card</DialogTitle>
            <div className="flex items-stretch gap-2 mt-3">
              {steps.map((s, i) => {
                const active = i === step;
                const done = i < step;
                return (
                  <div key={i}
                    className={`flex-1 min-w-0 px-3 py-2 border rounded-sm text-[11px] sm:text-xs uppercase tracking-wider truncate text-center ${active ? "bg-[#0066FF] border-[#0066FF] text-white" : done ? "border-[#0066FF]/40 text-[#3385FF]" : "border-border text-muted-foreground"}`}
                    title={`${i + 1}. ${s}`}
                  >
                    <span className="font-mono-data mr-1">{i + 1}.</span>{s}
                  </div>
                );
              })}
            </div>
          </DialogHeader>

          <div className="mt-4" data-testid="job card-wizard">
            {step === 0 && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider">Customer</Label>
                    {customerId && !customerSearch ? (
                      // Selected state — compact card with Change button
                      <div className="mt-1 border border-[#0066FF]/40 bg-[#0066FF]/5 rounded-sm p-3 flex items-start justify-between gap-2" data-testid="wizard-customer-selected">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{customers.find(c => c.id === customerId)?.name}</div>
                          <div className="text-[11px] font-mono-data text-muted-foreground truncate">{customers.find(c => c.id === customerId)?.mobile}</div>
                        </div>
                        <button type="button" onClick={() => { setCustomerId(""); setVehicleId(""); }} className="text-[11px] text-[#3385FF] hover:underline shrink-0" data-testid="wizard-change-customer">Change</button>
                      </div>
                    ) : quickAddOpen ? (
                      // Inline quick-add form
                      <div className="mt-1 border border-[#0066FF]/40 bg-[#0066FF]/5 rounded-sm p-3 space-y-2" data-testid="wizard-quickadd-form">
                        <div className="text-[10px] uppercase tracking-widest text-[#3385FF] font-semibold mb-1">+ New Customer</div>
                        <Input placeholder="Full name" value={qaName} onChange={e => setQaName(e.target.value)}
                          className="bg-background border-border rounded-sm h-9" data-testid="wizard-qa-name" autoFocus />
                        <Input placeholder="+96599887766" value={qaMobile}
                          onKeyDown={(e) => {
                            if (["Backspace","ArrowLeft","ArrowRight","Delete","Tab","Home","End"].includes(e.key)) return;
                            if (e.metaKey || e.ctrlKey) return;
                            if (e.key === "+" && qaMobile === "") return;
                            if (!/^\d$/.test(e.key)) e.preventDefault();
                          }}
                          onChange={e => {
                            const v = e.target.value;
                            const cleaned = v.startsWith("+") ? "+" + v.slice(1).replace(/\D/g, "") : v.replace(/\D/g, "");
                            setQaMobile(cleaned);
                          }}
                          className="bg-background border-border rounded-sm h-9 font-mono-data" data-testid="wizard-qa-mobile" />
                        <div className="flex justify-end gap-2 pt-1">
                          <Button type="button" variant="outline" size="sm" onClick={() => { setQuickAddOpen(false); setQaName(""); setQaMobile(""); }} className="border-border rounded-sm h-8" data-testid="wizard-qa-cancel">Cancel</Button>
                          <Button type="button" size="sm" onClick={quickAddCustomer} disabled={qaSaving || !qaName.trim() || !qaMobile.trim()} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm h-8" data-testid="wizard-qa-save">{qaSaving ? "Saving…" : "Save Customer"}</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="relative mt-1">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input placeholder="Type name or mobile to search…" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                            className="pl-9 bg-background border-border rounded-sm h-10" data-testid="wizard-customer-search" autoFocus />
                        </div>
                        {/* Results: only when user has typed something */}
                        {customerSearch.trim().length > 0 && (
                          <div className="mt-2 border border-border rounded-sm divide-y divide-border max-h-[220px] overflow-y-auto" data-testid="wizard-customer-results">
                            {filteredCustomers.length === 0 && <div className="p-3 text-xs text-muted-foreground text-center">No customers match.</div>}
                            {filteredCustomers.slice(0, 8).map(c => (
                              <button key={c.id} type="button" onClick={() => { setCustomerId(c.id); setVehicleId(""); setCustomerSearch(""); }}
                                className="w-full text-left px-3 py-2 hover:bg-white/[0.03] flex items-center justify-between gap-2"
                                data-testid={`wizard-pick-customer-${c.id}`}>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold truncate">{c.name}</div>
                                  <div className="text-[11px] font-mono-data text-muted-foreground truncate">{c.mobile}</div>
                                </div>
                              </button>
                            ))}
                            {filteredCustomers.length > 8 && (
                              <div className="px-3 py-1.5 text-[11px] text-muted-foreground text-center">+{filteredCustomers.length - 8} more — refine your search</div>
                            )}
                          </div>
                        )}
                        <button type="button" onClick={() => { setQuickAddOpen(true); setQaName(customerSearch.replace(/[+0-9]/g, "").trim()); setQaMobile(customerSearch.match(/^\+?\d+$/) ? customerSearch : ""); }}
                          className="mt-2 w-full text-left px-3 py-2 border border-dashed border-[#0066FF]/40 hover:border-[#0066FF] hover:bg-[#0066FF]/5 rounded-sm text-sm text-[#3385FF] flex items-center gap-2"
                          data-testid="wizard-quickadd-btn">
                          <Plus size={14} /> New Customer
                          {customerSearch.trim() && <span className="text-[11px] text-muted-foreground ml-auto">— "{customerSearch.trim()}"</span>}
                        </button>
                      </>
                    )}
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider">Vehicle (linked to customer)</Label>
                    <Select value={vehicleId} onValueChange={setVehicleId} disabled={!customerId}>
                      <SelectTrigger className="mt-1 bg-background border-border rounded-sm h-11" data-testid="wizard-vehicle-select"><SelectValue placeholder={customerId ? (vehicles.length ? "Select vehicle" : "No vehicles for this customer") : "Pick customer first"} /></SelectTrigger>
                      <SelectContent className="bg-[#0F1115] border-border">
                        {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.vehicle_type}) — {v.plate || "no plate"}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {customerId && vehicles.length === 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">No vehicles linked to this customer. Add a vehicle from the customer page first.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === servicesIdx && (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">Pick the services to include in this job card. Use the search to filter by name or category.</div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search services by name or category…" value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} className="pl-9 bg-background border-border rounded-sm h-10" data-testid="wizard-service-search" />
                </div>
                <div className="border border-border rounded-sm divide-y divide-border max-h-[440px] overflow-y-auto">
                  {filteredServices.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">No services match.</div>}
                  {filteredServices.map(s => {
                    const sel = !!selectedServices.find(x => x.id === s.id);
                    const needsArea = AREA_SERVICE_MODES.includes(s.pricing_mode);
                    return (
                      <button key={s.id} type="button" onClick={() => toggleService(s)}
                        className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] ${sel ? "bg-[#0066FF]/5" : ""}`}
                        data-testid={`toggle-service-${s.id}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-5 h-5 border rounded-sm flex items-center justify-center text-[10px] font-bold shrink-0 ${sel ? "bg-[#0066FF] border-[#0066FF] text-white" : "border-border"}`}>{sel ? "✓" : ""}</div>
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
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm text-muted-foreground">Select areas for the chosen services. Each selection contributes to pricing.</div>
                  {(needsPanel || needsGlass) && (
                    <Button type="button" size="sm" onClick={selectFullVehicle} className="bg-emerald-600 hover:bg-emerald-500 rounded-sm" data-testid="select-full-vehicle">Select Full Vehicle</Button>
                  )}
                </div>
                {needsPanel && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Body Panels</div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={selectAllPanels} className="bg-[#0066FF]/10 hover:bg-[#0066FF] text-[#3385FF] hover:text-white border border-[#0066FF]/40 rounded-sm" data-testid="select-all-panels">All Panels</Button>
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
                        <Button type="button" size="sm" onClick={selectAllGlass} className="bg-[#0066FF]/10 hover:bg-[#0066FF] text-[#3385FF] hover:text-white border border-[#0066FF]/40 rounded-sm" data-testid="select-all-glass">All Glass</Button>
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
                <div className="border border-border rounded-sm overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-2">Service</th>
                        <th className="text-right px-4 py-2 w-24">Qty</th>
                        <th className="text-right px-4 py-2 w-32">Unit Price</th>
                        <th className="text-right px-4 py-2 w-32">Total</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, i) => (
                        <tr key={i} className="border-b border-border/60">
                          <td className="px-4 py-2"><div className="font-semibold">{l.service_name}</div>{l.selected_areas?.length > 0 && <div className="text-[11px] text-muted-foreground">{l.selected_areas.length} areas</div>}</td>
                          <td className="px-4 py-2"><Input type="number" step="0.01" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} className="w-full bg-background border-border rounded-sm h-8 text-sm text-right" data-testid={`review-line-qty-${i}`} /></td>
                          <td className="px-4 py-2"><Input type="number" step="0.001" value={l.unit_price} onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })} className="w-full bg-background border-border rounded-sm h-8 text-sm text-right" data-testid={`review-line-unit-${i}`} /></td>
                          <td className="px-4 py-2 text-right font-mono-data font-semibold">{fmtKWD(l.line_total)}</td>
                          <td className="px-2 py-2 text-right"><button onClick={() => setLines(lines.filter((_, x) => x !== i))} className="text-muted-foreground hover:text-[#FF3B30]"><Trash2 size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider">Discount Type</Label>
                    <Select value={discountType} onValueChange={setDiscountType}>
                      <SelectTrigger className="mt-1 bg-background border-border rounded-sm" data-testid="wizard-discount-type"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#0F1115] border-border">
                        <SelectItem value="amount">Fixed (KWD)</SelectItem>
                        <SelectItem value="percent">Percentage (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider">Discount Value</Label>
                    <Input type="number" step="0.001" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="mt-1 bg-background border-border rounded-sm" data-testid="wizard-discount-value" placeholder="0 (none)" />
                  </div>
                  <div><Label className="text-[10px] uppercase tracking-wider">Tax Rate (%)</Label><Input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="mt-1 bg-background border-border rounded-sm" /></div>
                </div>
                <div><Label className="text-[10px] uppercase tracking-wider">Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 bg-background border-border rounded-sm" /></div>
                <div className="border border-border rounded-sm p-4 ml-auto sm:w-80" data-testid="wizard-totals">
                  <Row label="Subtotal" value={fmtKWD(subtotal)} />
                  {showDiscountLine && <Row label={`Discount${discountType === "percent" ? ` (${discountValue}%)` : ""}`} value={`- ${fmtKWD(discountAmount)}`} testid="wizard-discount-line" />}
                  {taxRate > 0 && <Row label={`Tax (${taxRate}%)`} value={fmtKWD(taxAmount)} />}
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
              <Button onClick={submit} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="wizard-submit">Create Job Card</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Row = ({ label, value, big, testid }) => (
  <div className="flex items-center justify-between py-1" data-testid={testid}>
    <div className={`${big ? "text-sm uppercase tracking-widest text-muted-foreground font-semibold" : "text-xs text-muted-foreground"}`}>{label}</div>
    <div className={`font-mono-data ${big ? "text-2xl font-black" : "text-sm"}`}>{value}</div>
  </div>
);
