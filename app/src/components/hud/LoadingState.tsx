import { animated, useSpring } from "@react-spring/web";
import { useNeighborhood } from "../../query";

export function LoadingState() {
  const { isPending } = useNeighborhood();
  const { opacity } = useSpring({
    from: { opacity: 0 },
    to: { opacity: isPending ? 1 : 0 },
    config: { duration: 250 },
  });
  const { scale } = useSpring({
    from: { scale: 1 },
    to: { scale: 1.18 },
    loop: { reverse: true },
    config: { duration: 700 },
  });

  if (!isPending) return null;

  return (
    <div className="absolute inset-0 grid place-items-center bg-sky p-6">
      <animated.div className="paper-card p-6 text-center font-body text-ink" style={{ opacity }}>
        <animated.div
          style={{ transform: scale.to((s) => `scale(${s})`) }}
          className="text-5xl"
        >
          🏗️
        </animated.div>
        <h2 className="mt-3 font-display text-2xl font-semibold">Building Promptville…</h2>
        <p className="mt-1 text-sm opacity-70">Houses are popping up across town.</p>
      </animated.div>
    </div>
  );
}