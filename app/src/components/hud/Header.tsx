import { animated, useSpring } from "@react-spring/web";
import { List, Settings, Sun } from "lucide-react";
import { Tooltip } from "../ui/Tooltip";
import { useApp } from "../../store";

export function Header() {
  const toggleTweaks = useApp((s) => s.toggleTweaks);
  const toggleNavigator = useApp((s) => s.toggleNavigator);
  const showHeader = useApp((s) => s.tweaks.showHeader);
  const { opacity, y } = useSpring({
    from: { opacity: 0, y: -18 },
    to: { opacity: 1, y: 0 },
    config: { tension: 220, friction: 24 },
  });

  if (!showHeader) return null;

  return (
    <animated.header
      className="pointer-events-none absolute left-4 top-4 flex items-center gap-2"
      style={{ opacity, transform: y.to((v) => `translateY(${v}px)`) }}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full border-[3px] border-ink bg-amber-300 text-ink">
        <Sun size={20} />
      </span>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink drop-shadow-[2px_2px_0_rgba(255,255,255,0.8)]">
        Promptville
      </h1>
      <Tooltip label="Toggle session navigator (L)">
        <button
          type="button"
          onClick={toggleNavigator}
          aria-label="Toggle session navigator"
          className="pointer-events-auto ml-1 grid h-10 w-10 place-items-center rounded-full border-[3px] border-ink bg-cream text-ink transition-all duration-150 hover:-translate-y-0.5 hover:bg-amber-200 hover:shadow-[4px_4px_0_rgba(74,68,83,0.4)] active:translate-y-0 active:shadow-[1px_1px_0_rgba(74,68,83,0.4)]"
        >
          <List size={20} />
        </button>
      </Tooltip>
      <Tooltip label="Tweak display (P)">
        <button
          type="button"
          onClick={toggleTweaks}
          aria-label="Tweak display"
          className="pointer-events-auto ml-1 grid h-10 w-10 place-items-center rounded-full border-[3px] border-ink bg-cream text-ink transition-all duration-150 hover:-translate-y-0.5 hover:bg-amber-200 hover:shadow-[4px_4px_0_rgba(74,68,83,0.4)] active:translate-y-0 active:shadow-[1px_1px_0_rgba(74,68,83,0.4)]"
        >
          <Settings size={20} />
        </button>
      </Tooltip>
    </animated.header>
  );
}