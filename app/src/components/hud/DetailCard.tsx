import { useApp } from "../../store";

export function DetailCard() {
  const selected = useApp((s) => s.selected);
  const clearSelection = useApp((s) => s.clearSelection);
  if (!selected) return null;

  const date = new Date(selected.timeCreated).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="paper-card absolute bottom-16 left-1/2 w-80 -translate-x-1/2 p-4 font-body text-ink">
      <button
        onClick={clearSelection}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border-2 border-ink/50 text-sm hover:bg-ink/10"
        aria-label="Close"
      >
        ✕
      </button>
      <h2 className="font-display text-lg font-semibold leading-snug">{selected.title}</h2>
      <dl className="mt-2 space-y-1 text-sm">
        <Row k="Model" v={selected.model ?? "unknown"} />
        <Row k="Agent" v={selected.agent ?? "—"} />
        <Row k="Cost" v={`$${selected.cost.toFixed(4)}`} />
        <Row k="Tokens" v={`${selected.tokensIn} in / ${selected.tokensOut} out`} />
        <Row k="Date" v={date} />
      </dl>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="opacity-70">{k}</dt>
      <dd className="text-right font-bold">{v}</dd>
    </div>
  );
}