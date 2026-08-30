import { animated, useSpring } from "@react-spring/web";
import { Music, X } from "lucide-react";
import { useApp } from "../../store";

// Attribution panel for the soundtrack. The music is Nintendo's Animal Crossing:
// New Horizons OST — click the info button in the header to read this.
export function SoundInfo() {
  const open = useApp((s) => s.soundInfoOpen);
  const toggleSoundInfo = useApp((s) => s.toggleSoundInfo);
  const { opacity, y } = useSpring({
    from: { opacity: 0, y: -6 },
    opacity: open ? 1 : 0,
    y: open ? 0 : -6,
    config: { tension: 220, friction: 24 },
  });
  if (!open) return null;

  // Center via the transform only (no Tailwind translate classes, which the
  // spring transform would override). The card is clickable for the close button.
  return (
    <animated.div
      className="pointer-events-none absolute left-1/2 top-1/2 z-30 w-[24rem]"
      style={{
        opacity,
        transform: y.to((v) => `translate(-50%, calc(-50% + ${v}px))`),
      }}
    >
      <div className="paper-card pointer-events-auto p-4 font-body text-ink">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full border-[3px] border-ink bg-amber-300 text-ink">
              <Music size={16} />
            </span>
            <h2 className="font-display text-xl font-semibold">Soundtrack</h2>
          </div>
          <button
            type="button"
            onClick={toggleSoundInfo}
            aria-label="Close soundtrack credits"
            className="grid h-8 w-8 place-items-center rounded-full border-2 border-ink/60 bg-ink/5 text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mt-2 text-sm">
          The background music is from{" "}
          <strong>Animal Crossing: New Horizons</strong> —{" "}
          <strong>“5 p.m. (Sunny Weather)”</strong> during the day, and{" "}
          <strong>“5 a.m.”</strong> at night.
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
          “5 p.m. (Sunny Weather)” · “5 a.m.”
        </p>
      </div>
    </animated.div>
  );
}
