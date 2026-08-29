import { useEffect, useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import { Construction, Volume2 } from "lucide-react";
import { useNeighborhood } from "../../query";
import { useApp } from "../../store";

// Full-screen opaque loading splash. It covers EVERYTHING — the Canvas and all
// HUD panels (Clock, signals, stats, block labels) — so nothing leaks through
// while the town builds. Once data is ready it swaps to a single "enable sound"
// button: clicking it grants audio permission (the user gesture browsers need)
// and dismisses the splash in one go.
export function Splash() {
  const { isPending, data } = useNeighborhood();
  const musicOn = useApp((s) => s.musicOn);
  const toggleMusic = useApp((s) => s.toggleMusic);
  const loading = isPending || !data;
  const [mode, setMode] = useState<"loading" | "ready" | "gone" | "done">("loading");

  const handleEnable = () => {
    if (!musicOn) toggleMusic();
    setMode("gone");
  };
  const handleSilent = () => {
    if (musicOn) toggleMusic();
    setMode("gone");
  };

  const { opacity } = useSpring({
    from: { opacity: 1 },
    to: { opacity: mode === "gone" ? 0 : 1 },
    config: { duration: 450 },
    onRest: () => {
      if (mode === "gone") setMode("done");
    },
  });

  // Reveal the sound prompt once data has loaded.
  useEffect(() => {
    if (!loading && mode === "loading") setMode("ready");
  }, [loading, mode]);

  if (mode === "done") return null;

  return (
    <animated.div
      className="fixed inset-0 z-[100] grid place-items-center bg-sky"
      style={{ opacity, pointerEvents: loading || mode === "ready" ? "auto" : "none" }}
    >
      {mode === "loading" || loading ? (
        <div className="paper-card p-8 text-center font-body text-ink">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-ink bg-amber-300 text-ink">
            <Construction size={34} />
          </div>
          <h2 className="mt-3 font-display text-3xl font-semibold">Building Promptville…</h2>
          <p className="mt-1 text-sm opacity-70">Houses are popping up across town.</p>
        </div>
      ) : (
        <div className="w-72 text-center font-body text-ink">
          <div className="paper-card p-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-ink bg-amber-300 text-ink">
              <Volume2 size={32} />
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold">Turn on sound?</h2>
            <p className="mt-1 text-sm opacity-70">Enable the Promptville soundtrack.</p>
            <button
              type="button"
              onClick={handleEnable}
              className="mt-4 w-full rounded-xl border-[3px] border-ink bg-amber-300 py-2.5 font-display text-base font-semibold text-ink transition-all duration-150 hover:-translate-y-0.5 hover:bg-amber-200 hover:shadow-[4px_4px_0_rgba(74,68,83,0.4)] active:translate-y-0 active:shadow-[1px_1px_0_rgba(74,68,83,0.4)]"
            >
              Sound on
            </button>
            <button
              type="button"
              onClick={handleSilent}
              className="mt-2 w-full rounded-xl py-1.5 text-sm font-semibold text-ink/60 transition-colors hover:text-ink"
            >
              Continue without sound
            </button>
          </div>
        </div>
      )}
    </animated.div>
  );
}
