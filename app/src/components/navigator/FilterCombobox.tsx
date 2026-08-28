import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, X } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

export function FilterCombobox({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) => !selected.includes(o.value) && (!q || o.label.toLowerCase().includes(q)),
    );
  }, [options, selected, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const add = (value: string) => {
    onChange(selected.includes(value) ? selected : [...selected, value]);
    setQuery("");
    setActive(0);
  };
  const remove = (value: string) => onChange(selected.filter((v) => v !== value));

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(available.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = available[active] ?? available[0];
      if (o) add(o.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative text-xs">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 rounded-lg border-2 border-ink/40 bg-cream px-2 py-1 font-bold hover:bg-ink/10"
        >
          {label}
          {selected.length > 0 && <span className="opacity-60">· {selected.length}</span>}
          <ChevronDown size={13} className={`transition ${open ? "rotate-180" : ""}`} />
        </button>
        {selected.map((v) => {
          const o = options.find((x) => x.value === v);
          return (
            <span
              key={v}
              className="flex items-center gap-1 rounded-full border-2 border-ink/40 bg-amber-200 px-2 py-0.5 font-bold"
            >
              {o?.label ?? v}
              <button
                type="button"
                onClick={() => remove(v)}
                aria-label={`Remove ${o?.label ?? v}`}
                className="grid place-items-center hover:text-ink"
              >
                <X size={11} />
              </button>
            </span>
          );
        })}
      </div>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-60">
          <div className="paper-card p-1.5">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder={`Search ${label}…`}
              className="w-full rounded-lg border-2 border-ink/40 bg-cream px-2 py-1 text-xs outline-none focus:border-ink"
            />
            <ul className="mt-1 max-h-40 overflow-y-auto">
              {available.length === 0 && (
                <li className="px-2 py-1 opacity-60">
                  {selected.length === options.length ? "All selected" : "No matches"}
                </li>
              )}
              {available.map((o, i) => (
                <li key={o.value}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => add(o.value)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left ${
                      i === active ? "bg-ink/10" : ""
                    }`}
                  >
                    <span className="truncate">{o.label}</span>
                    {selected.includes(o.value) && <Check size={12} className="shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
