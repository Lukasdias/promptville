import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { personVoxels, placeVoxels, type Voxel } from "../../voxel";
import { crowdLayout } from "../../crowd";
import { crowd } from "../../config";
import { useApp } from "../../store";
import { useCity } from "../../city";
import { useNeighborhood } from "../../query";
import { InstancedVoxels } from "./InstancedVoxels";

const PERSON_SIZE = 0.15;
const BUBBLE_H = 1.2;

// Fallback bubbles when there is no real DB content yet.
const FALLBACK_LINES = [
  "Nice weather today, huh?",
  "Did you see the new plaza?",
  "This town grows every day.",
];

function Bubble({
  seed,
  anchor,
  lines,
  timeOffset,
}: {
  seed: number;
  anchor: { x: number; z: number };
  lines: string[];
  timeOffset: number;
}) {
  // Pick a starting line, then advance to the next real snippet each cycle so a
  // bubble cycles through the actual chatter instead of sticking on one quote.
  const [idx, setIdx] = useState(seed % lines.length);
  // React state drives visibility — a ref would not re-render the JSX.
  const [visible, setVisible] = useState(true);
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    // Stagger each cluster's clock so two groups never show the same line at the
    // same time (otherwise they advance in lockstep and repeat each other).
    const cycle = crowd.bubbleDuration + crowd.quietDuration;
    const local = t.current + timeOffset;
    const on = (local % cycle) < crowd.bubbleDuration;
    if (on !== visible) setVisible(on);
    // On each new visible window, step to the next line (cycles back).
    const next = on ? Math.floor(local / cycle) % lines.length : idx;
    if (next !== idx) setIdx(next);
  });
  return (
    <group position={[anchor.x, BUBBLE_H, anchor.z]}>
      {visible && (
        <Html center distanceFactor={16} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              background: "#fff6e5",
              border: "3px solid #4a4453",
              borderRadius: 12,
              boxShadow: "4px 4px 0 rgba(74,68,83,0.35)",
              padding: "8px 14px",
              fontFamily: '"Nunito", sans-serif',
              fontWeight: 700,
              fontSize: 14,
              lineHeight: 1.35,
              color: "#4a4453",
              whiteSpace: "normal",
              maxWidth: 240,
              textAlign: "center",
            }}
          >
            {lines[idx % lines.length]}
          </div>
        </Html>
      )}
    </group>
  );
}

export function Crowd() {
  const { blocks, renderStreets } = useCity();
  const showPeople = useApp((s) => s.tweaks.showPeople);
  const { data } = useNeighborhood();
  const layout = useMemo(() => crowdLayout(blocks, renderStreets), [blocks, renderStreets]);

  // Real short lines from the opencode DB, filtered to bubble-length snippets so
  // a bubble never shows dangling ellipsis. Fall back to the cozy pool when empty.
  const lines = useMemo(() => {
    const SHORT = 60;
    const fromDb = (data?.chatter ?? []).filter((l) => l.length <= SHORT);
    const pool = fromDb.length > 0 ? fromDb : FALLBACK_LINES;
    return pool.length > 0 ? pool : FALLBACK_LINES;
  }, [data]);

  // Batch all standing people by shirt colour → one InstancedVoxels per colour.
  const byColor = useMemo(() => {
    const map = new Map<string, Voxel[]>();
    for (const c of layout.clusters) {
      for (const m of c.members) {
        const arr = map.get(m.shirt) ?? [];
        arr.push(...placeVoxels(personVoxels(m.shirt), m.x, m.z, PERSON_SIZE));
        map.set(m.shirt, arr);
      }
    }
    return [...map.entries()].map(([shirt, voxels]) => ({ shirt, voxels }));
  }, [layout]);

  if (!showPeople || byColor.length === 0) return null;

  return (
    <group>
      {byColor.map(({ shirt, voxels }) => (
        <InstancedVoxels key={shirt} voxels={voxels} voxelSize={PERSON_SIZE} />
      ))}
      {layout.clusters.filter((c) => c.talking).map((c, i) => (
        <Bubble
          key={i}
          seed={i * 3 + 17}
          anchor={c.anchor}
          lines={lines}
          timeOffset={i * ((crowd.bubbleDuration + crowd.quietDuration) / 2)}
        />
      ))}
    </group>
  );
}
