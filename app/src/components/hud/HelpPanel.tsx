import { animated, useSpring } from "@react-spring/web";
import { useApp } from "../../store";

interface Row {
  keys: string[];
  label: string;
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Move",
    rows: [
      { keys: ["W", "A", "S", "D"], label: "Pan" },
      { keys: ["↑", "↓", "←", "→"], label: "Pan" },
      { keys: ["Drag"], label: "Pan the map" },
      { keys: ["M"], label: "Toggle edge scroll" },
    ],
  },
  {
    title: "Rotate",
    rows: [
      { keys: ["Q", "E"], label: "Rotate 45°" },
      { keys: ["R"], label: "Reset view" },
    ],
  },
  {
    title: "Zoom",
    rows: [
      { keys: ["Scroll"], label: "Zoom" },
      { keys: ["+", "−"], label: "Zoom in / out" },
    ],
  },
  {
    title: "Select",
    rows: [
      { keys: ["Click"], label: "Select a house" },
      { keys: ["F"], label: "Focus selection" },
      { keys: ["Esc"], label: "Clear selection" },
    ],
  },
  {
    title: "General",
    rows: [
      { keys: ["P"], label: "Tweak display" },
      { keys: ["Gear"], label: "Tweak display" },
      { keys: ["Tab"], label: "Toggle help" },
    ],
  },
];

export function HelpPanel() {
  const open = useApp((s) => s.helpOpen);
  const { opacity, y } = useSpring({
    from: { opacity: 0, y: -6 },
    opacity: open ? 1 : 0,
    y: open ? 0 : -6,
    config: { tension: 220, friction: 24 },
  });
  if (!open) return null;

  return (
    <animated.div
      className="pointer-events-none absolute left-1/2 top-1/2 w-[26rem] -translate-x-1/2 -translate-y-1/2"
      style={{ opacity, transform: y.to((v) => `translate(-50%, calc(-50% + ${v}px))`) }}
    >
      <div className="paper-card p-4 font-body text-ink">
        <h2 className="font-display text-xl font-semibold">Controls</h2>
        <div className="mt-2 space-y-3">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="font-display text-sm font-semibold opacity-70">{g.title}</h3>
              <ul className="mt-1 space-y-1">
                {g.rows.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex gap-1">
                      {r.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded-md border-2 border-ink/60 bg-ink/10 px-1.5 py-0.5 text-xs font-bold"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                    <span className="opacity-70">{r.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </animated.div>
  );
}