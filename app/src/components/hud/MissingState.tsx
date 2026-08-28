import { animated, useSpring } from "@react-spring/web";
import { MapPinOff } from "lucide-react";
import { useNeighborhood } from "../../query";

export function MissingState() {
  const { isPending, isError, error } = useNeighborhood();
  const spring = useSpring({
    opacity: isError ? 1 : 0,
    transform: isError ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(0.9)",
    config: { tension: 260, friction: 22 },
  });
  if (isPending || !isError) return null;

  return (
    <div className="absolute inset-0 grid place-items-center bg-sky p-6">
      <animated.div
        className="paper-card max-w-md p-6 text-center font-body text-ink"
        style={{
          opacity: spring.opacity,
          transform: spring.transform,
          position: "absolute",
          left: "50%",
          top: "50%",
        }}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-ink bg-amber-300 text-ink">
          <MapPinOff size={32} />
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold">Map not found</h2>
        <p className="mt-2 text-sm opacity-80">
          Promptville couldn't read the opencode database.
        </p>
        <p className="mt-1 break-all rounded-lg bg-ink/5 p-2 text-xs font-mono">{error.message}</p>
        <p className="mt-3 text-xs opacity-70">
          Ensure <code>~/.local/share/opencode/opencode.db</code> exists, or set{" "}
          <code>OPENCODE_DB_PATH</code>.
        </p>
      </animated.div>
    </div>
  );
}