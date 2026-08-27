import { animated, useSpring } from "@react-spring/web";

export function Header() {
  const { opacity, y } = useSpring({
    from: { opacity: 0, y: -18 },
    to: { opacity: 1, y: 0 },
    config: { tension: 220, friction: 24 },
  });

  return (
    <animated.header
      className="pointer-events-none absolute left-4 top-4 flex items-center gap-2"
      style={{ opacity, transform: y.to((v) => `translateY(${v}px)`) }}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full border-[3px] border-ink bg-amber-300 text-xl">
        ☀️
      </span>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink drop-shadow-[2px_2px_0_rgba(255,255,255,0.8)]">
        Promptville
      </h1>
    </animated.header>
  );
}