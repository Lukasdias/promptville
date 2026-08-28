import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { animated, useSpring } from "@react-spring/web";
import { RotateCcw } from "lucide-react";
import { Tooltip } from "../ui/Tooltip";
import { useNeighborhood } from "../../query";
import { filterNavItems, groupByDay, sortNavItems, type NavItem } from "../../navigator";
import { useApp } from "../../store";
import { SessionRow } from "./SessionRow";

type Row =
  | { kind: "day"; key: string; label: string }
  | { kind: "session"; key: string; item: NavItem };

export function NavigatorPanel() {
  const open = useApp((s) => s.navigatorOpen);
  const search = useApp((s) => s.search);
  const setSearch = useApp((s) => s.setSearch);
  const filters = useApp((s) => s.filters);
  const setFilter = useApp((s) => s.setFilter);
  const resetFilters = useApp((s) => s.resetFilters);
  const sortKey = useApp((s) => s.sortKey);
  const setSortKey = useApp((s) => s.setSortKey);
  const selected = useApp((s) => s.selected);
  const focusNonce = useApp((s) => s.searchFocusNonce);
  const { data } = useNeighborhood();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && focusNonce > 0) inputRef.current?.focus();
  }, [open, focusNonce]);

  const items = useMemo(() => {
    const projects = data?.projects ?? [];
    const filtered = filterNavItems(projects, search, filters);
    return sortNavItems(filtered, sortKey);
  }, [data, search, filters, sortKey]);

  const groups = useMemo(() => groupByDay(items), [items]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const g of groups) {
      out.push({ kind: "day", key: `day-${g.day}`, label: g.label });
      for (const item of g.items) out.push({ kind: "session", key: item.session.id, item });
    }
    return out;
  }, [groups]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: (i) => (rows[i]?.kind === "day" ? 24 : 62),
    overscan: 10,
    getItemKey: (i) => rows[i]?.key ?? i,
  });

  const possibleModels = useMemo(() => {
    const set = new Set<string>();
    for (const p of data?.projects ?? []) for (const s of p.sessions) if (s.model) set.add(s.model);
    return [...set].sort();
  }, [data]);

  const possibleAgents = useMemo(() => {
    const set = new Set<string>();
    for (const p of data?.projects ?? []) for (const s of p.sessions) if (s.agent) set.add(s.agent);
    return [...set].sort();
  }, [data]);

  const { opacity, x } = useSpring({
    from: { opacity: 0, x: -40 },
    to: { opacity: open ? 1 : 0, x: open ? 0 : -60 },
    config: { tension: 240, friction: 24 },
  });

  if (!open) return null;

  const sumTokens = (arr: typeof items) =>
    arr.reduce((a, i) => a + i.session.tokensIn + i.session.tokensOut, 0);
  const sumCost = (arr: typeof items) => arr.reduce((a, i) => a + i.session.cost, 0);

  return (
    <animated.aside
      className="absolute left-4 top-20 bottom-16 z-30 flex w-80 flex-col"
      style={{ opacity, transform: x.to((v) => `translateX(${v}px)`) }}
    >
      <div className="paper-card flex min-h-0 flex-1 flex-col overflow-hidden p-3 font-body text-ink">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions…"
            className="flex-1 rounded-lg border-2 border-ink/40 bg-cream px-3 py-1.5 font-body text-sm outline-none focus:border-ink"
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
            className="rounded-lg border-2 border-ink/40 bg-cream px-2 py-1.5 text-xs"
          >
            <option value="timeUpdated">Newest</option>
            <option value="cost">Cost</option>
            <option value="tokens">Tokens</option>
            <option value="title">Title</option>
          </select>
          <Tooltip label="Reset filters">
            <button
              type="button"
              onClick={resetFilters}
              className="grid h-8 w-8 place-items-center rounded-lg border-2 border-ink/40 text-ink hover:bg-ink/10"
              aria-label="Reset filters"
            >
              <RotateCcw size={14} />
            </button>
          </Tooltip>
        </div>

        <div className="mt-2 flex flex-wrap gap-1 text-xs">
          <select
            multiple
            value={filters.projects}
            onChange={(e) => setFilter("projects", [...e.target.selectedOptions].map((o) => o.value))}
            className="min-w-24 rounded-lg border-2 border-ink/40 bg-cream px-1 py-1"
          >
            <option value="" disabled>Projects</option>
            {(data?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select
            multiple
            value={filters.models}
            onChange={(e) => setFilter("models", [...e.target.selectedOptions].map((o) => o.value))}
            className="min-w-24 rounded-lg border-2 border-ink/40 bg-cream px-1 py-1"
          >
            <option value="" disabled>Models</option>
            {possibleModels.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            multiple
            value={filters.agents}
            onChange={(e) => setFilter("agents", [...e.target.selectedOptions].map((o) => o.value))}
            className="min-w-24 rounded-lg border-2 border-ink/40 bg-cream px-1 py-1"
          >
            <option value="" disabled>Agents</option>
            {possibleAgents.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs opacity-70">
          <span>{items.length} sessions</span>
          <span>${sumCost(items).toFixed(2)} · {sumTokens(items).toLocaleString()} tok</span>
        </div>

        <div ref={listRef} className="mt-2 flex-1 overflow-y-auto pr-1">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm opacity-60">No sessions match.</p>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
              {virtualizer.getVirtualItems().map((vi) => {
                const row = rows[vi.index];
                return (
                  <div
                    key={vi.key}
                    data-index={vi.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vi.start}px)`,
                      paddingBottom: row.kind === "session" ? 6 : 2,
                    }}
                  >
                    {row.kind === "day" ? (
                      <div className="py-1 text-[11px] font-bold uppercase tracking-wide opacity-50">
                        {row.label}
                      </div>
                    ) : (
                      <SessionRow item={row.item} active={selected?.id === row.item.session.id} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </animated.aside>
  );
}
