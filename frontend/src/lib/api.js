import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

export const API = BACKEND_URL
  ? `${BACKEND_URL.replace(/\/$/, "")}/api`
  : "/api";

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("auth_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      const path = window.location.pathname;
      if (path !== "/login") {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export const fileUrl = (relative) => {
  if (!relative) return "";
  if (relative.startsWith("http")) return relative;

  const base = BACKEND_URL ? BACKEND_URL.replace(/\/$/, "") : "";
  return `${base}${relative}`;
};

export const fmtKWD = (n) => {
  const v = Number(n || 0);
  return `KWD ${v.toFixed(3)}`;
};

export const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
};

export const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

export const waLink = (mobile, msg) => {
  const digits = (mobile || "").replace(/[^0-9]/g, "");
  const text = msg ? `?text=${encodeURIComponent(msg)}` : "";
  return `https://wa.me/${digits}${text}`;
};

export const downloadCSV = (filename, rows) => {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export const fmtSeconds = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

/**
 * Open WhatsApp with a pre-filled message that links to a publicly accessible
 * page (deployment URL of the quotation/invoice). The receiver opens the link
 * to download/print the PDF themselves.
 *
 * Browsers block direct file attachments through wa.me, so the standard pattern
 * is: include a link in the message body. If the customer opens it on a phone,
 * WhatsApp handles the share dialog cleanly.
 */
export const waShareDocument = (mobile, label, url, extraMessage = "") => {
  const msg = [extraMessage, `${label}: ${url}`].filter(Boolean).join("\n\n");
  const digits = (mobile || "").replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
};
