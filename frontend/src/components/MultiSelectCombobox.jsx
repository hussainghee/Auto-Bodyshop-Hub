import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";

/**
 * Searchable, multi-select combobox.
 *  options: [{ value, label }] OR string[]
 *  values: string[]
 *  onChange: (string[]) => void
 */
export default function MultiSelectCombobox({
  options = [], values = [], onChange, placeholder = "Any",
  emptyText = "No matches", disabled = false, testId, className = "",
}) {
  const [open, setOpen] = useState(false);
  const norm = (options || []).map(o => typeof o === "string" ? { value: o, label: o } : o);

  const toggle = (v) => {
    const next = values.includes(v) ? values.filter(x => x !== v) : [...values, v];
    onChange?.(next);
  };
  const remove = (e, v) => {
    e.stopPropagation();
    onChange?.(values.filter(x => x !== v));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={`w-full bg-background border border-border rounded-sm h-9 px-3 flex items-center justify-between gap-1 text-sm hover:border-[#0066FF]/40 disabled:opacity-50 ${className}`}
          data-testid={testId}
        >
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            {values.length === 0 && <span className="text-muted-foreground truncate">{placeholder}</span>}
            {values.slice(0, 3).map(v => {
              const lab = norm.find(o => o.value === v)?.label ?? v;
              return (
                <span key={v} className="inline-flex items-center gap-1 bg-[#0066FF]/15 text-[#3385FF] border border-[#0066FF]/40 rounded-sm px-1.5 py-0.5 text-[11px] font-mono-data">
                  {lab}
                  <X size={10} className="cursor-pointer hover:text-white" onClick={(e) => remove(e, v)} />
                </span>
              );
            })}
            {values.length > 3 && <span className="text-[11px] text-muted-foreground">+{values.length - 3}</span>}
          </div>
          <ChevronsUpDown size={14} className="text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-[#0F1115] border-border" align="start">
        <Command className="bg-transparent">
          <CommandInput placeholder="Search…" className="h-9" data-testid={testId ? `${testId}-search` : undefined} />
          <CommandList className="max-h-[260px]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {norm.map(o => {
                const sel = values.includes(o.value);
                return (
                  <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}
                    className="cursor-pointer aria-selected:bg-white/5">
                    <Check size={14} className={sel ? "opacity-100 text-[#3385FF]" : "opacity-0"} />
                    <span className="flex-1">{o.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
