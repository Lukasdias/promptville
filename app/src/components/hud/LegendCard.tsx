import { animated, useSpring } from "@react-spring/web";
import { MODEL_ROOF, UNKNOWN_ROOF, BUILDING_COLORS } from "../../theme";
import { BUILDING_META } from "../../civic";
import { useApp } from "../../store";

export function LegendCard() {
  const show = useApp((s) => s.tweaks.showLegend);
  const { opacity, y } = useSpring({
    from: { opacity: 0, y: 10 },
    opacity: show ? 1 : 0,
    y: show ? 0 : 10,
    config: { tension: 220, friction: 24 },
  });
  if (!show) return null;

  return (
    <animated.div
      className="pointer-events-none absolute bottom-4 right-4 w-56"
      style={{ opacity, transform: y.to((v) => `translateY(${v}px)`) }}
    >
      <div className="paper-card p-3 font-body text-ink">
        <h3 className="font-display text-sm font-semibold">Roof colors</h3>
        <ul className="mt-1 space-y-1 text-xs">
          {Object.entries(MODEL_ROOF).map(([model, color]) => (
            <li key={model} className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full border border-ink/30" style={{ background: color }} />
              <span className="truncate">{model}</span>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full border border-ink/30" style={{ background: UNKNOWN_ROOF }} />
            <span>other</span>
          </li>
        </ul>
        <div className="mt-3 border-t border-ink/10 pt-2">
          <h4 className="font-display text-xs font-semibold">Civic buildings</h4>
          <ul className="mt-1 space-y-1 text-xs">
            {Object.entries(BUILDING_META).map(([kind, meta]) => (
              <li key={kind} className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-ink/30"
                  style={{ background: BUILDING_COLORS[kind as keyof typeof BUILDING_COLORS].body }}
                />
                <span className="truncate">
                  <meta.icon size={12} className="inline" /> {meta.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </animated.div>
  );
}