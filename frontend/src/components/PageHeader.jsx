export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 border-b border-border px-4 sm:px-8 py-4 sm:py-6 bg-[#0a0b0e] sticky top-0 z-20" data-testid="page-header">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1 truncate">{subtitle || "Workshop"}</div>
        <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tighter break-words">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}
