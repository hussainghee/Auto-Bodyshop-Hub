import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

/**
 * Cascading Make/Model selector loaded from /api/vehicle-makes.
 * Falls back to free-text input if make is "Other".
 * Props: make, model, onChange({make, model}), required?
 */
export default function MakeModelSelect({ make, model, onChange, required }) {
  const [makes, setMakes] = useState([]);

  useEffect(() => {
    api.get("/vehicle-makes").then(r => setMakes(r.data)).catch(() => setMakes([]));
  }, []);

  const current = makes.find(m => m.label === make);
  const isOther = make === "__other__";

  const setMake = (val) => {
    if (val === "__other__") onChange({ make: "__other__", model: "" });
    else onChange({ make: val, model: "" });
  };

  return (
    <>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">Make {required && "*"}</Label>
        <Select value={make || ""} onValueChange={setMake}>
          <SelectTrigger className="mt-1 bg-background border-border rounded-sm" data-testid="make-select"><SelectValue placeholder="Select make" /></SelectTrigger>
          <SelectContent className="bg-[#0F1115] border-border max-h-[300px]">
            {makes.map(m => <SelectItem key={m.id} value={m.label}>{m.label}</SelectItem>)}
            <SelectItem value="__other__">Other (type manually)</SelectItem>
          </SelectContent>
        </Select>
        {isOther && (
          <Input className="mt-2 bg-background border-border rounded-sm" placeholder="Enter make"
            value={model && make === "__other__" ? "" : ""} onChange={() => {}}
            data-testid="make-other-input"
            onBlur={(e) => onChange({ make: e.target.value || "__other__", model: model })} />
        )}
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">Model {required && "*"}</Label>
        {current && current.models?.length > 0 ? (
          <Select value={model || ""} onValueChange={(v) => onChange({ make, model: v })}>
            <SelectTrigger className="mt-1 bg-background border-border rounded-sm" data-testid="model-select"><SelectValue placeholder="Select model" /></SelectTrigger>
            <SelectContent className="bg-[#0F1115] border-border max-h-[300px]">
              {current.models.map(md => <SelectItem key={md} value={md}>{md}</SelectItem>)}
              <SelectItem value="__other_model__">Other (type manually)</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input className="mt-1 bg-background border-border rounded-sm" placeholder="Enter model"
            value={model || ""} onChange={(e) => onChange({ make, model: e.target.value })} data-testid="model-input" />
        )}
        {model === "__other_model__" && (
          <Input className="mt-2 bg-background border-border rounded-sm" placeholder="Enter model"
            onBlur={(e) => onChange({ make, model: e.target.value })} data-testid="model-other-input" />
        )}
      </div>
    </>
  );
}
