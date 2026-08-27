import { animated, useSpring } from "@react-spring/web";

export function HintBar() {
  const { opacity, y } = useSpring({
    from: { opacity: 0, y: 14 },
    to: { opacity: 1, y: 0 },
    delay: 350,
    config: { tension: 200, friction: 24 },
  });

  return (
    <animated.div
      className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border-[3px] border-ink/70 bg-cream px-4 py-1.5 font-body text-sm font-bold text-ink/80 shadow-[3px_3px_0_rgba(74,68,83,0.2)]"
      style={{ opacity, transform: y.to((v) => `translate(-50%, ${v}px)`) }}
    >
      Drag to orbit · Scroll to zoom · Click a house
    </animated.div>
  );
}