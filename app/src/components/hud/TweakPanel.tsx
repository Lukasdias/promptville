import type { ReactNode } from "react";
import { animated, useSpring } from "@react-spring/web";
import { useApp } from "../../store";

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-3 text-sm"
    >
      <span>{label}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full border-2 border-ink/60 transition-colors ${
          value ? "bg-amber-300" : "bg-ink/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-ink transition-all ${
            value ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-sm font-semibold opacity-70">{title}</h3>
      <div className="mt-1 space-y-1.5">{children}</div>
    </div>
  );
}

export function TweakPanel() {
  const open = useApp((s) => s.tweaksOpen);
  const t = useApp((s) => s.tweaks);
  const setTweak = useApp((s) => s.setTweak);
  const setStatsRow = useApp((s) => s.setStatsRow);
  const resetTweaks = useApp((s) => s.resetTweaks);

  const { opacity, x } = useSpring({
    from: { opacity: 0, x: -16 },
    opacity: open ? 1 : 0,
    x: open ? 0 : -16,
    config: { tension: 220, friction: 24 },
  });
  if (!open) return null;

  return (
    <animated.div
      className="absolute left-4 top-1/2 w-72 -translate-y-1/2"
      style={{ opacity, transform: x.to((v) => `translateX(${v}px)`) }}
    >
      <div className="paper-card p-4 font-body text-ink">
        <h2 className="font-display text-lg font-semibold">Tweak display</h2>
        <div className="mt-3 space-y-3">
          <Group title="Panels">
            <Toggle label="City stats" value={t.showStats} onChange={(v) => setTweak("showStats", v)} />
            <Toggle label="Header" value={t.showHeader} onChange={(v) => setTweak("showHeader", v)} />
            <Toggle label="Detail card" value={t.showDetailCard} onChange={(v) => setTweak("showDetailCard", v)} />
            <Toggle label="Hint bar" value={t.showHintBar} onChange={(v) => setTweak("showHintBar", v)} />
            <Toggle label="Roof legend" value={t.showLegend} onChange={(v) => setTweak("showLegend", v)} />
          </Group>
          <Group title="Stats rows">
            <Toggle label="Cost" value={t.statsRows.cost} onChange={(v) => setStatsRow("cost", v)} />
            <Toggle label="Tokens" value={t.statsRows.tokens} onChange={(v) => setStatsRow("tokens", v)} />
            <Toggle label="Busiest day" value={t.statsRows.busiestDay} onChange={(v) => setStatsRow("busiestDay", v)} />
            <Toggle label="Top models" value={t.statsRows.models} onChange={(v) => setStatsRow("models", v)} />
            <Toggle label="Top agents" value={t.statsRows.agents} onChange={(v) => setStatsRow("agents", v)} />
            <Toggle label="Top projects" value={t.statsRows.projects} onChange={(v) => setStatsRow("projects", v)} />
          </Group>
          <Group title="World">
            <Toggle label="People" value={t.showPeople} onChange={(v) => setTweak("showPeople", v)} />
            <Toggle label="Traffic" value={t.showTraffic} onChange={(v) => setTweak("showTraffic", v)} />
            <Toggle label="Scenery" value={t.showScenery} onChange={(v) => setTweak("showScenery", v)} />
            <Toggle label="Mountains" value={t.showMountains} onChange={(v) => setTweak("showMountains", v)} />
          </Group>
          <button
            type="button"
            onClick={resetTweaks}
            className="w-full rounded-lg border-2 border-ink/60 py-1.5 text-sm font-bold hover:bg-ink/10"
          >
            Reset defaults
          </button>
        </div>
      </div>
    </animated.div>
  );
}