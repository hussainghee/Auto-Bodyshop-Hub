export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border px-8 py-6 bg-[#0a0b0e] sticky top-0 z-20" data-testid="page-header">
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">{subtitle || "Workshop"}</div>
        <h1 className="font-display text-3xl font-black tracking-tighter">{title}</h1>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}
