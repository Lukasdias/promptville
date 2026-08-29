import { useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import { Construction } from "lucide-react";
import { useNeighborhood } from "../../query";

// Full-screen opaque loading splash. It covers EVERYTHING — the Canvas and all
// HUD panels (Clock, signals, stats, block labels) — so nothing leaks through
// while the town builds. It only releases once the neighborhood data is present.
export function Splash() {
  const { isPending, data } = useNeighborhood();
  const loading = isPending || !data;
  const [done, setDone] = useState(false);

  const { opacity } = useSpring({
    from: { opacity: 1 },
    to: { opacity: loading ? 1 : 0 },
    config: { duration: 450 },
    onRest: () => {
      if (!loading) setDone(true);
    },
  });
  // Keep it mounted until fully faded so the release is smooth.
  if (done) return null;

  return (
    <animated.div
      className="fixed inset-0 z-[100] grid place-items-center bg-sky"
      style={{ opacity, pointerEvents: loading ? "auto" : "none" }}
    >
      <div className="paper-card p-8 text-center font-body text-ink">
        <animated.div
          style={{
            transform: opacity.to({ range: [0.5, 1], output: [0.85, 1.1] }).to((s) => `scale(${s})`),
          }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-ink bg-amber-300 text-ink"
        >
          <Construction size={34} />
        </animated.div>
        <h2 className="mt-3 font-display text-3xl font-semibold">Building Promptville…</h2>
        <p className="mt-1 text-sm opacity-70">Houses are popping up across town.</p>
      </div>
    </animated.div>
  );
}
