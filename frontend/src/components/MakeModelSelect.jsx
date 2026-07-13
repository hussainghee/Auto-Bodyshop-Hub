import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

/**
 * Cascading Make/Model selector loaded from /api/vehicle-makes.
 * Falls back to free-text input when "Other (type manually)" is chosen.
 * Props: make, model, onChange({make, model}), required?
 *
 * The free-text make/model values are stored directly in `make` / `model`
 * (no sentinel is persisted). Local flags keep the dropdown showing
 * "Other (type manually)" while the user types.
 */
export default function MakeModelSelect({ make, model, onChange, required }) {
  const [makes, setMakes] = useState([]);
  const [makeOther, setMakeOther] = useState(false);
  const [modelOther, setModelOther] = useState(false);

  useEffect(() => {
    api.get("/vehicle-makes").then(r => setMakes(r.data || [])).catch(() => setMakes([]));
  }, []);

  const current = makes.find(m => m.label === make);

  // When editing a vehicle whose saved make isn't in the seeded list,
  // automatically switch to free-text ("Other") mode so it stays editable.
  useEffect(() => {
    if (makes.length && make && !current) setMakeOther(true);
  }, [makes, make, current]);

  const setMake = (val) => {
    if (val === "__other__") {
      setMakeOther(true);
      setModelOther(false);
      onChange({ make: "", model: "" });
    } else {
      setMakeOther(false);
      setModelOther(false);
      onChange({ make: val, model: "" });
    }
  };

  const setModel = (val) => {
    if (val === "__other_model__") {
      setModelOther(true);
      onChange({ make, model: "" });
    } else {
      setModelOther(false);
      onChange({ make, model: val });
    }
  };

  // While in free-text make mode, keep the dropdown label on "Other".
  const makeSelectValue = makeOther ? "__other__" : (make || "");
  const modelSelectValue = modelOther ? "__other_model__" : (model || "");

  // Show the preset-model dropdown only when a listed make with models is selected.
  const showModelDropdown = !makeOther && current && current.models?.length > 0;

  return (
    <>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">Make {required && "*"}</Label>
        <Select value={makeSelectValue} onValueChange={setMake}>
          <SelectTrigger className="mt-1 bg-background border-border rounded-sm" data-testid="make-select">
            <SelectValue placeholder="Select make" />
          </SelectTrigger>
          <SelectContent className="bg-[#0F1115] border-border max-h-[300px]">
            {makes.map(m => <SelectItem key={m.id} value={m.label}>{m.label}</SelectItem>)}
            <SelectItem value="__other__">Other (type manually)</SelectItem>
          </SelectContent>
        </Select>
        {makeOther && (
          <Input
            className="mt-2 bg-background border-border rounded-sm"
            placeholder="Enter make"
            value={make || ""}
            onChange={(e) => onChange({ make: e.target.value, model })}
            data-testid="make-other-input"
          />
        )}
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">Model {required && "*"}</Label>
        {showModelDropdown ? (
          <Select value={modelSelectValue} onValueChange={setModel}>
            <SelectTrigger className="mt-1 bg-background border-border rounded-sm" data-testid="model-select">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="bg-[#0F1115] border-border max-h-[300px]">
              {current.models.map(md => <SelectItem key={md} value={md}>{md}</SelectItem>)}
              <SelectItem value="__other_model__">Other (type manually)</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            className="mt-1 bg-background border-border rounded-sm"
            placeholder="Enter model"
            value={model || ""}
            onChange={(e) => onChange({ make, model: e.target.value })}
            data-testid="model-input"
          />
        )}
        {showModelDropdown && modelOther && (
          <Input
            className="mt-2 bg-background border-border rounded-sm"
            placeholder="Enter model"
            value={model || ""}
            onChange={(e) => onChange({ make, model: e.target.value })}
            data-testid="model-other-input"
          />
        )}
      </div>
    </>
  );
}
