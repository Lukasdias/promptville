import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, PointsMaterial } from "three";
import { mulberry32 } from "../../rand";
import { useApp } from "../../store";
import { nightRef } from "../../night";

const WIDTH = 16;
const HEIGHT = 7;
const DEPTH = 16;
const SETTLE = 0.15; // downward drift, world units / second
const WAFT = 0.12; // lateral sway amplitude speed multiplier

interface Mote {
  x: number;
  y: number;
  z: number;
  twinkle: number;
  sway: number;
}

export function DustMotes({
  count = 160,
  color = "#dcecff",
}: {
  count?: number;
  color?: string;
}) {
  const showDust = useApp((s) => s.tweaks.showDust);
  const ref = useRef<Points>(null);

  // Deterministic placement + per-mote sway phase. Never Math.random().
  const motes = useMemo<Mote[]>(() => {
    const rand = mulberry32(888);
    const out: Mote[] = [];
    for (let i = 0; i < count; i++) {
      out.push({
        x: (rand() - 0.5) * WIDTH,
        y: rand() * HEIGHT,
        z: (rand() - 0.5) * DEPTH,
        twinkle: rand() * Math.PI * 2,
        sway: rand() * Math.PI * 2,
      });
    }
    return out;
  }, [count]);

  const { positions, geometry } = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(arr, 3));
    return { positions: arr, geometry: geo };
  }, [count]);

  const mat = useMemo(
    () =>
      new PointsMaterial({
        color,
        size: 0.05,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [color],
  );

  useFrame((_, delta) => {
    const geo = geometry;
    const arr = positions;
    const t = motes;
    for (let i = 0; i < t.length; i++) {
      const m = t[i];
      m.y -= SETTLE * delta;
      m.x += Math.sin((m.sway += delta)) * WAFT * delta;
      m.z += Math.cos(m.sway) * WAFT * delta;
      if (m.y < 0) m.y += HEIGHT;
      if (m.x > WIDTH / 2) m.x -= WIDTH;
      else if (m.x < -WIDTH / 2) m.x += WIDTH;
      if (m.z > DEPTH / 2) m.z -= DEPTH;
      else if (m.z < -DEPTH / 2) m.z += DEPTH;
      const j = i * 3;
      arr[j] = m.x;
      arr[j + 1] = m.y;
      arr[j + 2] = m.z;
    }
    geo.attributes.position.needsUpdate = true;
    // Subtle global twinkle; fade the glow at night so it doesn't wash out.
    const twinkle = 0.85 + 0.15 * Math.abs(Math.sin(motes[0]?.twinkle ?? 0));
    mat.opacity = 0.9 * twinkle - nightRef.current * 0.5;
  });

  if (!showDust) return null;

  return <points ref={ref} geometry={geometry} material={mat} frustumCulled={false} />;
}
