import { useNeighborhood } from "../../query";

function fmtCost(c: number): string {
  return `$${c.toFixed(4)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function StatsPanel() {
  const { data } = useNeighborhood();
  if (!data) return null;
  const { stats } = data;

  return (
    <aside className="paper-card absolute right-4 top-4 w-64 p-4 font-body text-ink">
      <h2 className="font-display text-lg font-semibold">City Stats</h2>
      <dl className="mt-2 space-y-1 text-sm">
        <Row k="Sessions" v={String(stats.totalSessions)} />
        <Row k="Total cost" v={fmtCost(stats.totalCost)} />
        <Row k="Tokens in" v={fmtTokens(stats.totalTokensIn)} />
        <Row k="Tokens out" v={fmtTokens(stats.totalTokensOut)} />
        <Row k="Busiest day" v={stats.busiestDay ?? "—"} />
      </dl>
      <h3 className="mt-3 font-display text-base font-semibold">Top models</h3>
      <ul className="mt-1 space-y-0.5 text-sm">
        {stats.topModels.slice(0, 4).map((m) => (
          <li key={m.model} className="flex justify-between gap-2">
            <span className="truncate">{m.model}</span>
            <span className="shrink-0 font-bold">{m.count}</span>
          </li>
        ))}
      </ul>
      <h3 className="mt-3 font-display text-base font-semibold">Top projects</h3>
      <ul className="mt-1 space-y-0.5 text-sm">
        {stats.topProjects.slice(0, 4).map((p) => (
          <li key={p.name} className="flex justify-between gap-2">
            <span className="truncate">{p.name}</span>
            <span className="shrink-0 font-bold">{p.count}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="opacity-70">{k}</dt>
      <dd className="font-bold">{v}</dd>
    </div>
  );
}