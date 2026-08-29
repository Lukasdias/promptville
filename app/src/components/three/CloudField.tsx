import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Cloud } from "@react-three/drei";
import type { Group } from "three";
import { mulberry32 } from "../../rand";
import { useApp } from "../../store";

const CLOUD_COUNT = 9;
const DRIFT = 0.8; // world units / second (wind speed)
// Horizontal half-extent of the cloud field. Kept generous so puffs wrap well
// past the town edge rather than popping in view.
const FIELD = 34;

interface Puff {
  position: [number, number, number];
  speed: number;
  opacity: number;
  scale: number;
}

// Deterministic seeded puff placement: same seed => same sky, every reload.
export function CloudField() {
  const showClouds = useApp((s) => s.tweaks.showClouds);
  const group = useRef<Group>(null);

  const puffs = useMemo<Puff[]>(() => {
    const rand = mulberry32(6001);
    const out: Puff[] = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      out.push({
        position: [(rand() - 0.5) * 2 * FIELD, 10 + rand() * 7, (rand() - 0.5) * 2 * FIELD],
        speed: 0.25 + rand() * 0.45,
        opacity: 0.7 + rand() * 0.3,
        scale: 0.7 + rand() * 0.9,
      });
    }
    return out;
  }, []);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    // Continuous wind: drift the whole cloud layer, toroidally wrapping so a
    // fixed puff count reads as an endless sky. Never setState — mutate the group.
    g.position.x += DRIFT * delta;
    if (g.position.x > FIELD * 0.5) g.position.x = -FIELD * 0.5;
  });

  if (!showClouds) return null;

  return (
    <group ref={group}>
      {puffs.map((c, i) => (
        <Cloud
          key={i}
          position={c.position}
          speed={c.speed}
          opacity={c.opacity}
          scale={c.scale}
        />
      ))}
    </group>
  );
}
