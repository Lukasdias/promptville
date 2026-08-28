import type { ReactNode } from "react";
import { animated, useSpring } from "@react-spring/web";
import { useApp } from "../../store";
import { BUILDING_META } from "../../civic";
import { openCommand } from "../../navigator";
import { useSession } from "../../query";

export function DetailCard() {
  const selected = useApp((s) => s.selected);
  const selectedBuilding = useApp((s) => s.selectedBuilding);
  const activity = useApp((s) => s.activity);
  const clearSelection = useApp((s) => s.clearSelection);
  const showDetailCard = useApp((s) => s.tweaks.showDetailCard);
  const pushToast = useApp((s) => s.pushToast);
  const { data: detail } = useSession(selected?.id ?? null);

  const show = Boolean(selected || selectedBuilding);

  const spring = useSpring({
    opacity: show ? 1 : 0,
    transform: show
      ? "translate(-50%, 0px) scale(1)"
      : "translate(-50%, 34px) scale(0.86)",
    config: { tension: 300, friction: 22 },
  });

  if (!show || !showDetailCard) return null;

  let body: ReactNode;
  if (selectedBuilding) {
    const meta = BUILDING_META[selectedBuilding];
    const a = activity[selectedBuilding];
    body = (
      <>
        <h2 className="pr-8 font-display text-lg font-semibold leading-snug">
          {meta.emoji} {meta.name}
        </h2>
        <dl className="mt-2 space-y-1 text-sm">
          <Row k="Services" v={meta.services.join(" · ")} />
          <Row k="Visitors now" v={a.visitors} />
          <Row k="Cars parked" v={a.cars} />
        </dl>
      </>
    );
  } else if (selected) {
    const date = new Date(selected.timeCreated).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    body = (
      <>
        <h2 className="pr-8 font-display text-lg font-semibold leading-snug">{selected.title}</h2>
        <dl className="mt-2 space-y-1 text-sm">
          <Row k="Model" v={selected.model ?? "unknown"} />
          <Row k="Agent" v={selected.agent ?? "—"} />
          <Row
            k="Cost"
            v={<AnimatedNumber value={selected.cost} format={(n) => `$${n.toFixed(4)}`} />}
          />
          <Row
            k="Tokens"
            v={
              <>
                <AnimatedNumber value={selected.tokensIn} format={(n) => Math.round(n).toLocaleString()} /> in /{" "}
                <AnimatedNumber value={selected.tokensOut} format={(n) => Math.round(n).toLocaleString()} /> out
              </>
            }
          />
          <Row k="Date" v={date} />
        </dl>
        {detail?.snippet && (
          <p className="mt-2 text-xs leading-snug opacity-70">{detail.snippet}</p>
        )}
        <button
          type="button"
          onClick={() => {
            if (!selected) return;
            const cmd = openCommand(selected);
            navigator.clipboard.writeText(cmd).then(
              () => pushToast("success", `Copied: ${cmd}`),
              () => pushToast("error", "Could not copy command"),
            );
          }}
          className="mt-3 w-full rounded-lg border-2 border-ink/40 bg-cream py-1.5 font-display text-sm font-semibold hover:bg-ink/10"
        >
          Open in opencode ↗
        </button>
      </>
    );
  } else {
    body = null;
  }

  return (
    <animated.div
      className="paper-card absolute bottom-16 left-1/2 w-80 p-4 font-body text-ink"
      style={{ opacity: spring.opacity, transform: spring.transform }}
    >
      <button
        onClick={clearSelection}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border-2 border-ink/50 text-sm hover:bg-ink/10"
        aria-label="Close"
      >
        ✕
      </button>
      {body}
    </animated.div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="opacity-70">{k}</dt>
      <dd className="text-right font-bold">{v}</dd>
    </div>
  );
}

function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format: (n: number) => string;
}) {
  const { n } = useSpring({
    from: { n: 0 },
    to: { n: value },
    config: { tension: 160, friction: 26 },
  });
  return <animated.span>{n.to((v) => format(v))}</animated.span>;
}