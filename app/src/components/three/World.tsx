import { useMemo } from "react";
import { Cloud, Float } from "@react-three/drei";
import type { PlacedBlock, Street } from "../../layout";
import { lampVoxels, treeVoxels, type Voxel } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";
import { COLORS } from "../../theme";

const TREE_SIZE = 0.22;
const LAMP_SIZE = 0.25;
const TREE_PAD = 1.0;
const SPREAD = 26;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clearSpot(x: number, z: number, blocks: PlacedBlock[], streets: Street[]): boolean {
  for (const b of blocks) {
    const half = b.width / 2 + TREE_PAD;
    const halfD = b.depth / 2 + TREE_PAD;
    if (x > b.x - half && x < b.x + half && z > b.z - halfD && z < b.z + halfD) return false;
  }
  for (const s of streets) {
    const hw = s.width / 2 + 0.4;
    const hd = s.depth / 2 + 0.4;
    if (x > s.x - hw && x < s.x + hw && z > s.z - hd && z < s.z + hd) return false;
  }
  return true;
}

export function World({
  blocks,
  streets,
}: {
  blocks: PlacedBlock[];
  streets: Street[];
}) {
  const rand = useMemo(() => mulberry32(1337), []);

  const trees = useMemo(() => {
    const placed: { key: number; x: number; z: number; s: number }[] = [];
    for (let key = 0; placed.length < 45 && key < 600; key++) {
      const x = (rand() - 0.5) * 2 * SPREAD;
      const z = (rand() - 0.5) * 2 * SPREAD;
      if (!clearSpot(x, z, blocks, streets)) continue;
      if (rand() < 0.18) continue;
      placed.push({ key, x, z, s: 0.7 + rand() * 0.6 });
    }
    return placed;
  }, [blocks, streets, rand]);

  const lamps = useMemo(() => {
    const placed: { key: number; x: number; z: number }[] = [];
    for (let key = 0; placed.length < 8 && key < 400; key++) {
      const x = (rand() - 0.5) * 2 * SPREAD;
      const z = (rand() - 0.5) * 2 * SPREAD;
      if (!clearSpot(x, z, blocks, streets)) continue;
      placed.push({ key, x, z });
    }
    return placed;
  }, [blocks, streets, rand]);

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
          <InstancedVoxels voxels={treeVoxels(COLORS.grassDark)} voxelSize={TREE_SIZE} />
        </group>
      ))}

      {/* Street lamps */}
      {lamps.map((l) => (
        <group key={l.key} position={[l.x, 0, l.z]}>
          <InstancedVoxels voxels={lampVoxels()} voxelSize={LAMP_SIZE} />
        </group>
      ))}
    </group>
  );
}