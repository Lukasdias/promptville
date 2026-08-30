import { useEffect, useState } from "react";
import { useApp } from "../../store";

const NUMERALS = [
  "XII",
  "I",
  "II",
  "III",
  "IIII",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
];

const FACE = 141;
const R = 53;
const TICK = 62;

function angleFor(h: number, m: number, s: number) {
  const hour = ((h % 12) + m / 60 + s / 3600) * 30;
  const minute = (m + s / 60) * 6;
  return { hour, minute, second: s * 6 };
}

export function Clock() {
  const show = useApp((s) => s.tweaks.showClock);
  const [now, setNow] = useState(() => new Date());
  // Pendulum swings on a continuous sine loop — deterministic and even, with no
  // spring overshoot/catch. (A `useSpring` with `loop: reverse` fights its own
  // stiffness and staggers at the extremes.)
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 40);
    return () => clearInterval(id);
  }, []);

  // Smooth sine: angle = sin(phase) * amplitude. At 25 ticks/sec this is a
  // gentle, continuous swing from -11° to +11°.
  const phase = (tick * 40) / 1000;
  const angle = Math.sin(phase * 1.4) * 11;

  if (!show) return null;

  const { hour, minute, second } = angleFor(
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  );

  return (
    <div className="pointer-events-none absolute right-[288px] top-4">
      <div className="flex flex-col items-center">
        <div className="relative z-10 -mb-3 flex h-7 w-7 items-end justify-center">
          <div className="flex flex-col items-center">
            <div className="h-2 w-2 rounded-full border-2 border-ink bg-amber-400" />
            <div className="h-4 w-1.5 rounded-b-full border-2 border-t-0 border-ink bg-amber-400" />
          </div>
        </div>
        <div className="relative -mb-2">
          <div className="relative h-6 w-16">
            <div className="absolute inset-0" style={{ clipPath: "polygon(50% 0, 100% 100%, 0 100%)", backgroundColor: "#4a4453" }} />
            <div className="absolute inset-[3px]" style={{ clipPath: "polygon(50% 0, 100% 100%, 0 100%)", backgroundColor: "#fcd34d" }} />
          </div>
        </div>

        <div className="-mt-1 flex flex-col items-center">
          <div
            className="rounded-3xl border-[3px] border-ink bg-[#f3e3c0] p-2 shadow-[4px_4px_0_rgba(74,68,83,0.3)]"
            style={{ paddingBottom: 6 }}
          >
            <div
              className="relative"
              style={{ width: FACE, height: FACE }}
            >
              <div className="absolute inset-0 rounded-full border-[3px] border-ink bg-cream">
                <div className="absolute inset-[7px] rounded-full border-2 border-ink/25" />
              </div>

              {NUMERALS.map((n, i) => (
                <span
                  key={n}
                  className="absolute left-1/2 top-1/2 font-display text-[12px] font-semibold leading-none text-ink"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-${R}px) rotate(-${i * 30}deg)`,
                  }}
                >
                  {n}
                </span>
              ))}

              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={`t${i}`}
                  className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-ink/20"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-${TICK}px)`,
                  }}
                />
              ))}

              <div
                className="absolute left-1/2 top-1/2 h-10 w-2 rounded-full border border-ink bg-amber-300"
                style={{
                  transform: `translate(-50%, -100%) rotate(${hour}deg)`,
                  transformOrigin: "50% 100%",
                }}
              />
              <div
                className="absolute left-1/2 top-1/2 w-2 rounded-full border border-ink bg-[#c98a5b]"
                style={{
                  height: 58,
                  transform: `translate(-50%, -100%) rotate(${minute}deg)`,
                  transformOrigin: "50% 100%",
                }}
              />
              <div
                className="absolute left-1/2 top-1/2 w-1 rounded-full bg-rose-500"
                style={{
                  height: 54,
                  transform: `translate(-50%, -100%) rotate(${second}deg)`,
                  transformOrigin: "50% 100%",
                }}
              />
              <div className="absolute left-1/2 top-1/2 z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-amber-300" />
            </div>

            <div className="mx-auto mt-1 h-3.5 w-[74%] rounded-full bg-[#e8c885] border-2 border-ink/40" />
          </div>

          <div className="mt-1.5">
            <div className="mx-auto flex h-12 w-14 flex-col items-center rounded-b-2xl rounded-t-md border-[3px] border-b-0 border-ink bg-[#5b4633] p-1">
              <div
                className="flex flex-col items-center"
                style={{
                  transform: `rotate(${angle}deg)`,
                  transformOrigin: "top center",
                }}
              >
                <div className="h-9 w-0.5 bg-[#e8c885]" />
                <div className="mt-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink bg-amber-300 shadow-[2px_2px_0_rgba(74,68,83,0.3)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
