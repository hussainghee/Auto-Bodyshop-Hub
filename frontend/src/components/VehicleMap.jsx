import { useState, useRef } from "react";
import { Upload, X } from "lucide-react";
import { api, fileUrl } from "../lib/api";
import { toast } from "sonner";

/**
 * Top-down vehicle map with numbered selectable polygons.
 * Props:
 *  - vehicleType: { panels: [{id,label,number}], glass_areas: [...] }
 *  - mode: "panel" | "glass"
 *  - selected: array of selected ids
 *  - onChange: (ids) => void
 *  - areaImages: { [id]: url }
 *  - onUploadImage: (id, url) => void
 */

// Panel polygon coords (top-view sedan)
const PANEL_SHAPES = {
  hood:        { points: "180,80 280,80 290,170 170,170", cx: 230, cy: 125 },
  roof:        { points: "175,180 285,180 285,300 175,300", cx: 230, cy: 240 },
  trunk:       { points: "175,310 285,310 280,400 180,400", cx: 230, cy: 355 },
  front_bumper:{ points: "165,55 295,55 280,75 180,75", cx: 230, cy: 65 },
  rear_bumper: { points: "180,405 280,405 295,425 165,425", cx: 230, cy: 415 },
  fl_fender:   { points: "120,90 170,90 170,170 120,170", cx: 145, cy: 130 },
  fr_fender:   { points: "290,90 340,90 340,170 290,170", cx: 315, cy: 130 },
  fl_door:     { points: "120,180 175,180 175,240 120,240", cx: 147, cy: 210 },
  rl_door:     { points: "120,245 175,245 175,300 120,300", cx: 147, cy: 272 },
  fr_door:     { points: "285,180 340,180 340,240 285,240", cx: 312, cy: 210 },
  rr_door:     { points: "285,245 340,245 340,300 285,300", cx: 312, cy: 272 },
  rl_qpanel:   { points: "120,310 175,310 180,395 125,395", cx: 150, cy: 350 },
  rr_qpanel:   { points: "285,310 340,310 335,395 280,395", cx: 312, cy: 350 },
  hull:        { points: "150,80 310,80 340,400 120,400", cx: 230, cy: 240 },
  deck:        { points: "180,150 280,150 280,330 180,330", cx: 230, cy: 240 },
};

const GLASS_SHAPES = {
  windshield:  { points: "190,140 270,140 280,175 180,175", cx: 230, cy: 158 },
  fl_glass:    { points: "180,180 195,180 195,235 180,235", cx: 187, cy: 207 },
  fr_glass:    { points: "265,180 280,180 280,235 265,235", cx: 272, cy: 207 },
  rl_glass:    { points: "180,245 195,245 195,295 180,295", cx: 187, cy: 270 },
  rr_glass:    { points: "265,245 280,245 280,295 265,295", cx: 272, cy: 270 },
  rear_glass:  { points: "190,310 270,310 280,345 180,345", cx: 230, cy: 327 },
  sunroof:     { points: "200,205 260,205 260,275 200,275", cx: 230, cy: 240 },
};

export default function VehicleMap({ vehicleType, mode = "panel", selected = [], onChange, areaImages = {}, onUploadImage }) {
  const fileRef = useRef(null);
  const [activeUploadId, setActiveUploadId] = useState(null);
  const [hover, setHover] = useState(null);

  const areas = mode === "panel" ? (vehicleType?.panels || []) : (vehicleType?.glass_areas || []);
  const shapes = mode === "panel" ? PANEL_SHAPES : GLASS_SHAPES;

  const toggle = (id) => {
    if (!onChange) return;
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadId) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads/area", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onUploadImage?.(activeUploadId, data.url);
      toast.success("Image uploaded");
    } catch { toast.error("Upload failed"); }
    setActiveUploadId(null);
    e.target.value = "";
  };

  return (
    <div className="grid md:grid-cols-[460px_1fr] gap-6">
      <div className="border border-border bg-[#0F1115] p-4 rounded-sm" data-testid="vehicle-map-svg-container">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
          {mode === "panel" ? "Body Panels" : "Glass Areas"} — Top View
        </div>
        <svg viewBox="80 30 280 420" className="w-full h-auto bg-grid">
          {areas.map(a => {
            const sh = shapes[a.id];
            if (!sh) return null;
            const isSel = selected.includes(a.id);
            return (
              <g key={a.id} onClick={() => toggle(a.id)} onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)}>
                <polygon
                  points={sh.points}
                  className={`vmap-area ${isSel ? "selected" : ""}`}
                  data-testid={`vmap-area-${a.id}`}
                />
                <text x={sh.cx} y={sh.cy + 4} className="vmap-label">{a.number}</text>
              </g>
            );
          })}
        </svg>
        {hover && (
          <div className="text-xs text-muted-foreground mt-2">
            Hover: <span className="text-white font-semibold">{areas.find(a => a.id === hover)?.label}</span>
          </div>
        )}
      </div>

      <div className="border border-border bg-[#0F1115] rounded-sm">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Selected Areas</div>
          <div className="text-xs text-muted-foreground">{selected.length} of {areas.length}</div>
        </div>
        <div className="divide-y divide-border max-h-[420px] overflow-y-auto" data-testid="selected-areas-list">
          {areas.map(a => {
            const isSel = selected.includes(a.id);
            const img = areaImages[a.id];
            return (
              <div key={a.id} className={`px-4 py-3 flex items-center gap-3 ${isSel ? "bg-[#0066FF]/5" : ""}`}>
                <button
                  onClick={() => toggle(a.id)}
                  className={`w-8 h-8 rounded-sm border text-xs font-bold ${isSel ? "bg-[#0066FF] border-[#0066FF] text-white" : "border-border text-muted-foreground hover:text-white"}`}
                  data-testid={`area-toggle-${a.id}`}
                >
                  {a.number}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{a.label}</div>
                  {img && <div className="text-[11px] text-emerald-400 mt-0.5">Image attached</div>}
                </div>
                {isSel && onUploadImage && (
                  <>
                    {img ? (
                      <a href={fileUrl(img)} target="_blank" rel="noreferrer" className="block">
                        <img src={fileUrl(img)} alt="" className="w-12 h-12 object-cover rounded-sm border border-border" />
                      </a>
                    ) : null}
                    <button
                      onClick={() => { setActiveUploadId(a.id); fileRef.current?.click(); }}
                      className="px-2 py-1.5 border border-border text-xs hover:border-[#0066FF] hover:text-[#0066FF] rounded-sm flex items-center gap-1"
                      data-testid={`upload-area-${a.id}`}
                    >
                      <Upload size={12} /> {img ? "Replace" : "Photo"}
                    </button>
                  </>
                )}
                {isSel && (
                  <button onClick={() => toggle(a.id)} className="text-muted-foreground hover:text-white p-1"><X size={14} /></button>
                )}
              </div>
            );
          })}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </div>
    </div>
  );
}
