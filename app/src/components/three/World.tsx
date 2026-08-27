import { useMemo } from "react";
import { Cloud, Float } from "@react-three/drei";
import { lampVoxels, treeVoxels } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";
import { COLORS } from "../../theme";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function World() {
  const rand = useMemo(() => mulberry32(1337), []);
  const trees = useMemo(
    () =>
      Array.from({ length: 45 }, (_, i) => ({
        key: i,
        x: (rand() - 0.5) * 60,
        z: (rand() - 0.5) * 60,
        s: 0.6 + rand() * 0.7,
        skip: rand() < 0.18,
      })).filter((t) => !t.skip),
    [rand],
  );

  const lamps = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        key: i,
        x: (rand() - 0.5) * 56,
        z: (rand() - 0.5) * 56,
      })),
    [rand],
  );

  return (
    <group>
      <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.4}>
        <Cloud position={[-14, 12, -18]} speed={0.4} opacity={0.9} />
        <Cloud position={[10, 15, -6]} speed={0.3} opacity={0.85} />
        <Cloud position={[22, 11, 8]} speed={0.5} opacity={0.8} />
      </Float>

      {/* Trees: one instanced voxel mesh per tree, scaled for variety */}
      {trees.map((t) => (
        <group key={t.key} position={[t.x, 0, t.z]} scale={t.s}>
          <InstancedVoxels voxels={treeVoxels(COLORS.grassDark)} />
        </group>
      ))}

      {/* Street lamps */}
      {lamps.map((l) => (
        <group key={l.key} position={[l.x, 0, l.z]}>
          <InstancedVoxels voxels={lampVoxels()} />
        </group>
      ))}
    </group>
  );
}