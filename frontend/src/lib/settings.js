import { useEffect, useState } from "react";
import { api } from "./api";

let cached = null;
let listeners = [];

const fetchSettings = async () => {
  try {
    const { data } = await api.get("/system-settings");
    cached = data;
    listeners.forEach(fn => fn(data));
  } catch { /* ignore */ }
};

if (typeof window !== "undefined") {
  window.addEventListener("system-settings-updated", fetchSettings);
}

export function useSystemSettings() {
  const [data, setData] = useState(cached);
  useEffect(() => {
    if (!cached) fetchSettings();
    const fn = (d) => setData(d);
    listeners.push(fn);
    return () => { listeners = listeners.filter(x => x !== fn); };
  }, []);
  return data || { toggles: {}, integrations: {} };
}

export function isFeatureEnabled(toggles, key, defaultVal = true) {
  if (!toggles) return defaultVal;
  return toggles[key] !== false;
}
