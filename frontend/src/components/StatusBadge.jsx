const MAP = {
  draft:       { label: "DRAFT",       fg: "#a1a1aa", bg: "rgba(161,161,170,0.10)", bd: "#3a3d44" },
  sent:        { label: "SENT",        fg: "#3385FF", bg: "rgba(0,102,255,0.10)",   bd: "#0066FF" },
  approved:    { label: "APPROVED",    fg: "#00FF66", bg: "rgba(0,255,102,0.08)",   bd: "#00FF66" },
  rejected:    { label: "REJECTED",    fg: "#FF3B30", bg: "rgba(255,59,48,0.08)",   bd: "#FF3B30" },
  confirmed:   { label: "CONFIRMED",   fg: "#3385FF", bg: "rgba(0,102,255,0.10)",   bd: "#0066FF" },
  in_progress: { label: "IN PROGRESS", fg: "#FFCC00", bg: "rgba(255,204,0,0.08)",   bd: "#FFCC00" },
  completed:   { label: "COMPLETED",   fg: "#00FF66", bg: "rgba(0,255,102,0.08)",   bd: "#00FF66" },
  cancelled:   { label: "CANCELLED",   fg: "#FF3B30", bg: "rgba(255,59,48,0.08)",   bd: "#FF3B30" },
};

export default function StatusBadge({ status }) {
  const s = MAP[status] || MAP.draft;
  return (
    <span className="tag-status" style={{ color: s.fg, background: s.bg, borderColor: s.bd }} data-testid={`status-${status}`}>
      {s.label}
    </span>
  );
}
