import { useMemo } from "react";
import { Cloud, Float } from "@react-three/drei";
import type { PlacedBlock, Street } from "../../layout";
import { lampVoxels, treeVoxels } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";
import { COLORS } from "../../theme";
import { useApp } from "../../store";
import { environment } from "../../config";
import { isClearSpot } from "../../placement";
import { mulberry32 } from "../../rand";

const TREE_SIZE = 0.22;
const LAMP_SIZE = 0.25;
const TREE_PAD = 1.0;
const SPREAD = 26;
const TREE_SCAN_LIMIT = 700;
const LAMP_SCAN_LIMIT = 400;
const TREE_SCALE_BASE = 0.7;
const TREE_SCALE_RANGE = 0.6;
const TREE_SKIP_CHANCE = 0.18;
const LAMP_CLEAR_PAD = 0.7;

const CLOUDS = [
  { position: [-14, 12, -18], speed: 0.4, opacity: 0.9 },
  { position: [10, 15, -6], speed: 0.3, opacity: 0.85 },
  { position: [22, 11, 8], speed: 0.5, opacity: 0.8 },
] as const;

export function World({
  blocks,
  streets,
}: {
  blocks: PlacedBlock[];
  streets: Street[];
}) {
  const rand = useMemo(() => mulberry32(1337), []);
  const showScenery = useApp((s) => s.tweaks.showScenery);

  const trees = useMemo(() => {
    const placed: { key: number; x: number; z: number; s: number }[] = [];
    for (let key = 0; placed.length < environment.trees && key < TREE_SCAN_LIMIT; key++) {
      const x = (rand() - 0.5) * 2 * SPREAD;
      const z = (rand() - 0.5) * 2 * SPREAD;
      if (!isClearSpot(x, z, blocks, streets, TREE_PAD)) continue;
      if (rand() < TREE_SKIP_CHANCE) continue;
      placed.push({ key, x, z, s: TREE_SCALE_BASE + rand() * TREE_SCALE_RANGE });
    }
    return placed;
  }, [blocks, streets, rand]);

  const lamps = useMemo(() => {
    const placed: { key: number; x: number; z: number }[] = [];
    for (let key = 0; placed.length < environment.lamps && key < LAMP_SCAN_LIMIT; key++) {
      const x = (rand() - 0.5) * 2 * SPREAD;
      const z = (rand() - 0.5) * 2 * SPREAD;
      if (!isClearSpot(x, z, blocks, streets, LAMP_CLEAR_PAD)) continue;
      placed.push({ key, x, z });
    }
    return placed;
  }, [blocks, streets, rand]);

  if (!showScenery) return null;

  return (
    <group>
      <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.4}>
        {CLOUDS.map((c, i) => (
          <Cloud key={i} position={c.position} speed={c.speed} opacity={c.opacity} />
        ))}
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