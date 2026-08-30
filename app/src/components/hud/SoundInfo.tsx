import { animated, useSpring } from "@react-spring/web";
import { Music } from "lucide-react";
import { useApp } from "../../store";

// Attribution panel for the soundtrack. The music is Nintendo's Animal Crossing:
// New Horizons OST — click the info button in the header to read this.
export function SoundInfo() {
  const open = useApp((s) => s.soundInfoOpen);
  const { opacity, y } = useSpring({
    from: { opacity: 0, y: -6 },
    opacity: open ? 1 : 0,
    y: open ? 0 : -6,
    config: { tension: 220, friction: 24 },
  });
  if (!open) return null;

  return (
    <animated.div
      className="pointer-events-none absolute left-1/2 top-1/2 w-[24rem] -translate-x-1/2 -translate-y-1/2"
      style={{ opacity, transform: y.to((v) => `translate(-50%, calc(-50% + ${v}px))`) }}
    >
      <div className="paper-card p-4 font-body text-ink">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full border-[3px] border-ink bg-amber-300 text-ink">
            <Music size={16} />
          </span>
          <h2 className="font-display text-xl font-semibold">Soundtrack</h2>
        </div>
        <p className="mt-2 text-sm">
          The background music is from{" "}
          <strong>Animal Crossing: New Horizons</strong> — “5 p.m. (Sunny
          Weather)”.
        </p>
        <p className="mt-2 text-sm opacity-80">
          The Animal Crossing series and all related content are the property of{" "}
          <strong>Nintendo</strong>.
        </p>
        <p className="mt-2 text-sm opacity-80">
          This is a fan project for demonstration. All soundtrack rights belong to
          their respective owners.
        </p>
        <p className="mt-2 break-all rounded-lg bg-ink/5 p-2 text-xs font-mono opacity-70">
          khinsider.com · Animal Crossing: New Horizons (2020 Switch) gamerip ·
          Track 2-05 “5 p.m. (Sunny Weather)”
        </p>
      </div>
    </animated.div>
  );
}
